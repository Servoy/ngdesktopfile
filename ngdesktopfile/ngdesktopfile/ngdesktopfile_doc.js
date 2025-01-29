/**
 * Returns the home dir of the user like c:/users/[username] under windows.
 * Will return always a both with forward slashes.
 * 
 * @return {String} The full path of the user's home directory, using forward slashes.
 */
function homeDir() {
}

/**
 * Returns the tmp directory of the client machine.
 * Will return always a both with forward slashes.
 * 
 * @return {String} The full path of the system's temporary directory, using forward slashes.
 */
function tmpDir() {
}

/**
 * returns an array of filenames that are in the given path. 
 * Please use forward slashes (/) instead of backward slashes.
 * 
 * @return {Array<String>} An array of filenames present in the specified directory path.
 */
function listDir(path) {
}

/**
 * Watches a directory for changes at the given path. 
 * 
 * @param {String} path - directory's full path
 * @param {Function} callback - the callback method to be executed
 */
function watchDir(path, callback) {
}

/**
 * Stop watching a directory found at the given path.
 */
function unwatchDir(path) {
}
/**
 * Watches a give path, that should represent a file, for modifications.
 * Please use forward slashes (/) instead of backward slashes in the path/filename
 */
function watchFile(path, callback) {
}

/**
 * Removes the watch to the file that was added by the watchFile() function.
 * Please use forward slashes (/) instead of backward slashes in the path/filename
 */
function unwatchFile(path) {
}

/**
 * A synchronous way to write bytes to a temporary file with a unique pseudo-random name, in a directory for temporary files.
 * This directory will be cleared when the ngDesktop window is closed or when clearTempFiles() is called.
 * 
 * The function returns the path of the created file as a string.
 * 
 * @param {Object} bytes
 *
 * @return {String}
 */
function writeTempFileSync(bytes) {
}

/**
 * Writes the given bytes to the path; if the path has sub-directories that are not there, then those are created.
 * If the path is missing or contains only the file name, then the native system dialog for saving files is used.
 * 
 * When done, the optional callback is called with the written path (as a string), or 'error'. An optional passThru object is also passed back to the callback function.
 * Please use forward slashes (/) instead of backward slashes in path/filename.
 */
function writeFile(path, bytes, callback, passThru) {
}

/**
 * Write a file to a given path. 
 * If called by a synchronised function, pass a Deferred object.
 */
function writeFileImpl(path, url, key, passThru, syncDefer) {
}

 /**
 * Reads and returns the content of the given file
 * 
 * @param {String} [path] The full path of the file to read.
 * @return {JSUpload} The content of the file.
 */
function  readFileSync(path) {
}

/**
 * Reads the given bytes of a path, the callback is a function that will get as parameters the 'path' as a String and the 'file' as a JSUpload object
 * If the path is missing or contain only the file name then the native system dialog for opening files it is called.
 * Please use forward slashes (/) instead of backward slashes in the path/filename
 * 
 */
function readFile(callback, path) {
	// empty impl, is implemented in server side api calling the impl method below.
}

function readFileImpl(path, id, syncDefer) {
}

/**
 * Select a folder and pass its path to the callback.
 */
function selectDirectory(callback) {
}

/**
* Return the selected folder.
* @param {String} [path] The initial path to open the directory selection dialog at.
* @return {String} The full path of the selected folder, or an empty string if no folder was selected.
*/
function selectDirectorySync( path ) {
}
	
/**
 * Return the selected file.
 */
function selectFileSync( path ) {
}

/**
 * Shows a file save dialog and calls the callback method with the file path.<br/><br/>
 * 
 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogbrowserwindow-options<br/><br/>
 * 
 * Core options are:<br/>
 * <ul>
 *   <li><b>title</b>: String the dialog title</li>
 *   <li><b>defaultPath</b>: String - absolute directory path, absolute file path, or file name to use by default.</li>
 *   <li><b>buttonLabel</b>: String - custom label for the confirmation button, when left empty the default label will be used.</li>
 *   <li><b>filters</b>: Array&lt;{name: String, extensions: Array&lt;String&gt;}&gt; - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])</li>
 * </ul>
 * @param {Function} callback A function that receives the selected file path as an argument.
 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=}} [options]
 */
function showSaveDialog(callback, options) {
}

/**
 * Shows a file save dialog.<br/><br/>
 * 
 * To not block any process, showSaveDialog with a callback method is preferred over this method.<br/><br/>
 * 
 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogsyncbrowserwindow-options<br/><br/>
 * 
 * Core options are:<br/>
 * <ul>
 *   <li><b>title</b>: String the dialog title</li>
 *   <li><b>defaultPath</b>: String - absolute directory path, absolute file path, or file name to use by default.</li>
 *   <li><b>buttonLabel</b>: String - custom label for the confirmation button, when left empty the default label will be used.</li>
 *   <li><b>filters</b>: Array&lt;{name: String, extensions: Array&lt;String&gt;}&gt; - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])</li>
 * </ul>
 * 
 * @param {Object} [options] {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=}}
 * @return {String} The full path of the selected file if the user confirmed the dialog, or an empty string if the dialog was canceled.
 */
function showSaveDialogSync(options) {
}

/**
 * Shows a file open dialog and calls the callback with the selected file path(s).<br/><br/>
 * 
 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowopendialogbrowserwindow-options<br/><br/>
 * 
 * The core options are:<br/>
 * <ul>
 * <li><b>title</b>: String the dialog title</li>
 * <li><b>defaultPath</b>: String the default (starting) path</li>
 * <li><b>buttonLabel</b>: String custom label for the confirmation button, when left empty the default label will be used.</li>
 * <li><b>filters</b>: Array&lt;{name: String, extensions: Array&lt;String&gt;}&gt; an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])</li>
 * <li><b>properties</b>: an Array of property keywords such as:
 *   <ul> 
 * 	   <li><code>openFile</code> - Allow files to be selected.</li>
 * 	   <li><code>openDirectory</code> - Allow directories to be selected.</li>
 *     <li><code>multiSelections</code> - Allow multiple paths to be selected.</li>
 *   </ul>
 * </li>
 * </ul>
 * 
 * @param {Function} callback A function that receives the selected file path(s) as an argument.
 * @param @param {Object} [options] {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=, properties: Array<String>}}
 */
function showOpenDialog(callback, options) {
}

/**
 * Shows a file open dialog and returns the selected file path(s).<br/><br/>
 * 
 * To not block any process, showOpenDialog with a callback method is preferred over this method.<br/><br/>
 * 
 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowopendialogsyncbrowserwindow-options<br/><br/>
 * 
 * Core options are:<br/>
 * <ul>
 *   <li><b>title</b>: String the dialog title</li>
 *   <li><b>defaultPath</b>: String the default (starting) path</li>
 *   <li><b>buttonLabel</b>: String custom label for the confirmation button, when left empty the default label will be used.</li>
 *   <li><b>filters</b>: Array&lt;{name: String, extensions: Array&lt;String&gt;}&gt; an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])</li>
 *   <li><b>properties</b>: an Array of property keywords such as:
 *    <ul>
 * 	   <li><code>openFile</code> - Allow files to be selected.</li>
 * 	   <li><code>openDirectory</code> - Allow directories to be selected.</li>
 *     <li><code>multiSelections</code> - Allow multiple paths to be selected.</li>
 *    </ul>
 *   </li>
 * </ul>
 * 
 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=, properties: Array<String>}} [options]
 * @return <Array<String>}  
 */
function showOpenDialogSync(options) {
}

/**
 * Delete the given file, returning a boolean indicating success or failure
 * @param {String} path The full path of the file to be deleted.
 * @return {boolean} True if the file was successfully deleted; otherwise, false.
 */
 function deleteFileSync(path) {
}

/**
 * Deletes the given file, optionally calling the error callback when unsuccessful
 * 
 * @param {String} path The full path of the file to be deleted.
 * @param {Function} [errorCallback] An optional callback function that will be invoked if the deletion fails.
 */
function deleteFile(path, errorCallback) {
}

/**
 * Return a 'stats' object containing related file's information's.
 * Please use forward slashes (/) instead of backward slashes in the path
 * 
 * @param {String} path The full path of the file whose statistics are to be retrieved.
 * @return {CustomType<ngdesktopfile.stats>} An object containing file-related information.
 */
function getFileStats(path) {
}

/**
 * Opens a file specified at the given path on the client. It will open it in the desktop's default manner.
 * This path must exist on the client's machine, you can't open a file with a path pointing to a file on the server; use
 * writeFile() first to write it to the clients machine.
 * 
 * If it fails, it returns a string containing the error message corresponding to the failure.
 * If the file has been successfully opened, it will return an empty string.
 * 
 * @param {String} path - file's full path on the client.
 * @return {String} an empty string if the file was successfully opened or a string containing the error message corresponding to the failure otherwise.
 */
function openFile(path) {
}


/**
 * Test whether or not the given path exists by checking with the file system.
 * It returns true if the path exists, false otherwise.
 * 
 * @param {String} path - file's full path
 * @return {boolean}
 */
function  exists(path) {
}

/**
 * Synchronously append data to a file, creating the file if it does not yet exist.
 * 
 * @param {String} path - file's full path
 * @param {String} text - text to be added
 * @param {String} [encoding] - default utf8
  * @return {Boolean} True if the data was successfully appended to the file; otherwise, false.
 */
function appendToTXTFile(path, text, encoding) {
}

/**
 * Synchronously copies src to dest. By default, dest is overwritten if it already exists.
 * 
 * @param {String} src - source filepath to copy
 * @param {String} dest - destination filepath of the copy operation
 * @param {Boolean} [overwriteDest] - default true
* @return {boolean} True if the file was successfully copied; otherwise, false.
 */
function copyFile(src, dest, overwriteDest) {
}

/**
 * Synchronously creates a folder, including any necessary but nonexistent parent folders.
 * 
 * @param {String} path - folders full path
 * @return {boolean} True if the folder was successfully created; otherwise, false.
 */
function createFolder(path) {
}

/**
 * Synchronously deletes a folder, fails when folder is not empty
 * 
 * @param {String} path - folders full path
 * @return {boolean} True if the folder was successfully deleted; otherwise, false.
 */
function deleteFolder(path) {
}

/**
 * Synchronously rename file at oldPath to the pathname provided as newPath. In the case that newPath already exists, it will be overwritten.
 * 
 * @param {String} oldPath - old file full path
 * @param {String} newPath - new file full path
 * 
 * @return {boolean} True if the file was successfully renamed; otherwise, false.
 */
function renameFile(oldPath, newPath) {
}

/**
 * Writes text to the given path/filename
 * 
 * @param {String} path
 * @param {String} text_data
 * @param {String} [encoding] optional, default 'utf8'
 * 
 * @return {boolean} True if the text was successfully written to the file; otherwise, false.
 */
function writeTXTFileSync(path, text_data, encoding) {
}

/**
 * Reads and returns the text of the given path/filename
 * 
 * @param {String} path The full path of the file to read.
 * @param {String} [encoding] optional, default 'utf8'
 * 
 * @return {String} The content of the file as a string, or an empty string if the file could not be read.
 */
function readTXTFileSync(path, encoding) {
}

/**
 * Set permisions to the specified file. 
 * If readOnly parameter is false, the file permisions flags will be set to read/write mode
 * 
 * 
 * @param path - file path
 * @return {boolean} True if the file permissions were successfully updated; otherwise, false.
 */
 function setReadOnly(path, flag) {
}

/**
 * Verify readonly status on the specified path. Returns true for readonly otherwise false
 * 
 * @param path - directory's full path
 * @return {boolean} True if the file or folder is read-only; otherwise, false.
 */
 function getReadOnly(path) {
}

/**
 * Clears the directory where temporary files are stored (e.g. when using writeTempFileSync(bytes)).
 * 
 * @return {boolean} True if the temporary files directory was successfully cleared; otherwise, false.
 */
function clearTempFiles() {	
}

/**
 * Retrieves the path to a special directory or file associated with the given name.
 *
 * @param {('home' | 'desktop' | 'temp' | 'documents' | 'downloads')} name - The name of the directory or file.
 * @returns {String} The path to a special directory or file associated with the name, or an empty string if the name is not one of the allowed values.
 */
function getPath(name) {
}
