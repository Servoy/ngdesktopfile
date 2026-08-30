# Spec: SVY-21322 — NGDesktopFile writeFile with a straight URL

## 1. Goal

Add a way to tell NGDesktop *"download what is at this URL and store it at this local path"*, without
first having to materialise the content as `byte[]` in the Servoy server and re-publish it as a media
URL.

## 2. Background

### 2.1 How `writeFile(path, bytes, callback, passThru)` works today

The flow is three-legged (server script → client service → HTTP GET back to the server):

1. `ngdesktopfile_server.js` — `$scope.api.writeFile()` stores the callback under a random `key`
   and calls the internal API:
   ```js
   $scope.api.writeFileImpl(path, servoyApi.getMediaUrl(bytes), key);
   ```
   `servoyApi.getMediaUrl(bytes)` writes the bytes into the server's media/blob store and returns a
   **relative** URL (e.g. `resources/dynamicblob/…`) that is only reachable **with the current
   client session**.
2. `NGDesktopFileService.writeFileImpl()` (`projects/ngdesktopfile/src/lib/ngdesktopfile.service.ts`)
   either uses the given path or opens a native save dialog, then calls `saveUrlToPath()`.
3. `saveUrlToPath()` does `this.net.request(...)` from inside Electron and streams the response into
   `fs.createWriteStream(realPath)`, then calls back into the server script via `writeCallback`.

So **the transport already is "download a URL to a local path"** — `writeFileImpl` even takes a
parameter literally named `url` (see `internalApi.writeFileImpl` in `ngdesktopfile.spec`). The only
reason a caller has to supply bytes is that the server script is hardcoded to produce the URL via
`getMediaUrl`.

### 2.2 Why the existing path can't just be handed an arbitrary URL

Three things in `saveUrlToPath` assume the URL is a session-scoped relative Servoy URL:

| # | Line (before this change) | Problem |
|---|---|---|
| a | `getFullUrl(url)` unconditionally prefixes `document.baseURI` | `https://example.com/x.pdf` becomes `http://localhost:8080/solution/https://example.com/x.pdf` |
| b | `session: this.remote.getCurrentWebContents().session, useSessionCookies: true` | sends the NGDesktop app's cookies to a third-party host |
| c | completion is detected with `writeSize === fileSize`, where `fileSize = parseInt(response.headers['content-length'])` | an arbitrary web server may answer **chunked** with no `Content-Length`. `fileSize` is then `NaN`, the equality never holds, the stream is never closed and **the callback never fires** |

(c) is the reason Johan's own example — `writeFile("test.txt", "www.google.com")` — would hang
today: google.com answers with `Transfer-Encoding: chunked`.

### 2.3 Johan's constraints (case comments)

- *"this is more for serving a file that doesn't need a session"* — correct: the new function is for
  URLs that are publicly fetchable, or fetchable with whatever cookies the target host itself owns.
  It is explicitly **not** a replacement for `writeFile(bytes)` when the content only exists as a
  Servoy in-memory blob.
- *"the API for that is really changed in the last releases"* — refers to the server-side file API.
  This design side-steps that entirely: nothing new is written server-side, the download happens
  **client-side, in Electron**, straight from the source host to disk. That is also what makes it
  strictly cheaper than today's round trip.

## 3. Design

### 3.1 New public API

```
writeFileFromUrl(path, url, callback, passThru)
```

Mirrors `writeFile` one-for-one, with `bytes: byte[]` replaced by `url: string`. Same callback
contract: `callback(writtenPathOrError, passThru)` where the first argument is the written path or
the literal string `'error'`.

**Why a new function and not an overload of `writeFile`:** Servoy `.spec` parameters are statically
typed and the framework does not support overloads. Loosening `bytes` to `object` and sniffing the
runtime type would silently downgrade `writeFile`'s signature in the script editor from
`Array<Number>` to `Object` for every existing user. A separate, self-documenting name is the better
trade.

### 3.2 URL handling

`writeFileFromUrl` accepts:

| Input | Treated as |
|---|---|
| `https://host/x.pdf`, `http://host/x.pdf` | absolute, used as-is |
| `//host/x.pdf` | protocol-relative, resolved against the page protocol |
| `www.google.com`, `host/x.pdf` | **scheme-less absolute** → `https://` is prepended |
| `/resources/…`, `resources/…` | relative → resolved against `document.baseURI`, i.e. the Servoy server (this is what the internal `writeFile` path keeps using) |

The scheme-less rule exists so Johan's literal example from the case works. The discriminator is
"the first path segment contains a dot and the string does not start with `/`".

### 3.3 Session/cookie scope

`saveUrlToPath` gains an "is this our own origin?" check:

- **same origin as the Servoy server** → unchanged behaviour (Electron session + session cookies).
  Required, otherwise the existing `writeFile` breaks.
- **different origin** → request without `session`/`useSessionCookies` and without the bogus
  `Content-Type: application/json` header that is currently set on a GET.

This keeps the NGDesktop session cookie from leaking to arbitrary hosts.

### 3.4 Robust stream completion

Replace the `writeSize === fileSize` completion test with the response's own `end` event:

```
response.on('data',  chunk => writer.write(chunk))
response.on('end',   ()    => writer.end(() => resolve()))
response.on('error', err   => fail(err))
```

Resolving from `writer.end()`'s callback (rather than `close()` + immediate resolve) also fixes a
latent race in the current code, where the callback can reach the server script before the OS has
flushed the file — a `readFileSync` immediately after `writeFile` could see a short file.

`Content-Length: 0` keeps its fast path (create the empty file, resolve).

These three fixes are shared code, so **the existing `writeFile` benefits from them too** — in
particular it stops hanging if the Servoy server ever answers chunked.

### 3.5 Redirects

Electron's `net.request` follows redirects by default (`redirect: 'follow'`), so `www.google.com`
→ `https://www.google.com/` works without extra code. No change needed.

## 4. Implementation plan

1. **`ngdesktopfile/ngdesktopfile/ngdesktopfile.spec`** — add to `api`:
   ```json
   "writeFileFromUrl": {
       "parameters": [
           {"name":"path", "type":"string"},
           {"name":"url", "type":"string"},
           {"name":"callback", "type":"function", "optional": true},
           {"name":"passThru", "type":"object", "optional": true}
       ],
       "async-now": true
   }
   ```

2. **`ngdesktopfile/ngdesktopfile/ngdesktopfile_server.js`** — add:
   ```js
   $scope.api.writeFileFromUrl = function(path, url, callback, passThru) {
       var key = Math.random().toString(10);
       storage[key] = { callback: callback, passThru: passThru };
       $scope.api.writeFileImpl(path, url, key);
   }
   ```
   i.e. identical to `writeFile` minus the `servoyApi.getMediaUrl()` wrapping.

3. **`ngdesktopfile/ngdesktopfile/ngdesktopfile_doc.js`** — JSDoc stub for `writeFileFromUrl`.

4. **`projects/ngdesktopfile/src/lib/ngdesktopfile.service.ts`**
   - empty `writeFileFromUrl()` stub (implemented server-side, like `writeFile`);
   - `getFullUrl()` → return absolute URLs untouched, prepend `https://` for scheme-less hosts,
     prefix `document.baseURI` only for genuinely relative ones;
   - `saveUrlToPath()` → build request options conditionally on same-origin; switch completion to
     `response.on('end')` + `writer.end(cb)`.

5. The legacy AngularJS implementation `ngdesktopfile/ngdesktopfile/ngdesktopfile.js` is **not**
   updated — it has not been maintained since 2023 (last functional commits SVY-20785 / SVY-21321
   touch only the `.ts` service) and NGDesktop runs the Titanium (NG2) client.

## 5. Acceptance criteria

- [ ] `plugins.ngdesktopfile.writeFileFromUrl('c:/tmp/g.html', 'www.google.com', cb)` writes the
      page and fires `cb` with the path.
- [ ] Works for an `https://` URL to a binary file (e.g. a PDF/PNG) — file is byte-identical to the
      source.
- [ ] Works for a host that answers **chunked** (no `Content-Length`) — this is the case that hangs
      today.
- [ ] A URL returning 404/500 fires the callback with `'error'` and does not leave a partial file
      behind.
- [ ] Omitting the directory part of `path` still opens the native save dialog.
- [ ] `passThru` is handed back to the callback unchanged.
- [ ] **Regression:** the existing `writeFile(path, bytes, cb, passThru)` still works, still uses the
      session cookies, and still resolves for both empty and non-empty content.
- [ ] The NGDesktop app's session cookie is not sent to a third-party host.

## 6. Out of scope

- A URL variant of `writeTempFileSync(bytes)` — same limitation exists there, but the case only asks
  about `writeFile`. Trivial follow-up if wanted.
- Progress reporting / resumable downloads.
- Authentication headers for the external URL (basic auth in the URL works, custom headers do not).
- Updating the legacy AngularJS `ngdesktopfile.js`.

## 7. Open questions

| Question | Owner | Status |
|----------|-------|--------|
| Name: `writeFileFromUrl` vs `downloadFile`/`writeUrlToFile`? | Johan | assumed `writeFileFromUrl` |
| Should a scheme-less string really default to `https://`, or be rejected? | Johan | assumed default to `https://`, to match the `writeFile("test.txt","www.google.com")` example in the case |
