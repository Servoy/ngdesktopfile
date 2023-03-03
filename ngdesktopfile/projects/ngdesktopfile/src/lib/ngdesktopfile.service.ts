import { Injectable } from '@angular/core';
import { LoggerFactory, LoggerService, Deferred, WindowRefService, ServoyPublicService } from '@servoy/public';


import * as fs from 'fs';
import * as os from 'os';
import * as electron from 'electron';
import * as chokidar from 'chokidar';
import { WriteFileOptions } from 'fs';


@Injectable()
export class NGDesktopFileService {

    private defer: Deferred<any>;
    private log: LoggerService;
    private watchers = new Map();
    private fs: typeof fs;
    private os: typeof os;
    private chokidar: typeof chokidar;
    private remote: electron.Remote;
    private shell: electron.Shell;
    private session: typeof electron.Session;
    private dialog: electron.Dialog;
    private net;
    private formData; // typeof formData;

    constructor(private servoyService: ServoyPublicService, private windowRef: WindowRefService, logFactory: LoggerFactory) {
        this.log = logFactory.getLogger('NGDesktopFileService');
        const userAgent = navigator.userAgent.toLowerCase();
        const r = this.windowRef.nativeWindow['require'];
        if (userAgent.indexOf(' electron/') > -1 && r) {
            this.fs = r('fs');
            this.os = r('os');
            this.chokidar = r('chokidar');
            this.formData = r('form-data');
            this.remote = r('@electron/remote');
            this.shell = r('electron').shell;
            this.session = this.remote.session;
            this.dialog = this.remote.dialog;
            this.net = this.remote.net;
        } else {
            this.log.warn('ngdesktopfile service/plugin loaded in a none electron environment!');
        }
    }
    waitForDefered<T>(func: () => T): T | Promise<T> {
        if (this.defer != null) {
            return this.defer.promise.then(() => this.waitForDefered(func));
        } else return func();
    }

    /**
     * Returns the home dir of the user like c:/users/[username] under windows.
     * Will return always a both with forward slashes.
     */
    homeDir() {
        return this.os.homedir().replace(/\\/g, '/');
    }

    /**
     * Returns the tmp directory of the client machine.
     * Will return always a both with forward slashes.
     */
    tmpDir() {
        return this.os.tmpdir().replace(/\\/g, '/');
    }

    /**
     * returns an array of filenames that are in the given path.
     * Please use forward slashes (/) instead of backward slashes.
     */
    listDir(path: string) {
        const listDefer = new Deferred();
        this.waitForDefered(() => {
            this.fs.readdir(path, (_error, files) => {
                listDefer.resolve(files);
            });
        });
        return listDefer.promise;
    }

    /**
     * Watches a directory for changes at the given path.
     *
     * @param dir - directory's full path
     * @param callback - the callback method to be executed
     */
    watchDir(dir: string, callback: { formname: string; script: string }) {
        /** Please check the below used library here: https://github.com/paulmillr/chokidar
         * add, addDir, change, unlink, unlinkDir these are all events.
         * add is for adding file
         * addDir is for adding folders
         * unlink is for deleting files
         * unlinkDir is for delete folders
         * change is for changing files **/
        if (!this.watchers.get(dir)) {
            // Initialize watcher
            const watcher = this.chokidar.watch(dir, {
                ignoreInitial: true,
                alwaysStat: true
            });
            this.waitForDefered(() => {
                watcher.on('add', (path, stats) => {
                    this.log.debug('this is an add event\n', 'path: ' + path + '\n', stats);
                    this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
                }).on('addDir', (path, stats) => {
                    this.log.debug('this is an addDir event\n', 'path: ' + path + '\n', stats);
                    this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
                }).on('change', (path, stats) => {
                    // For MacOS: Do not make the callback when .DS_Store is changed.
                    // DS_Store is a file that stores custom attributes of its containing folder,
                    // such as the position of icons or the choice of a background image
                    if (!path.includes('.DS_Store')) {
                        this.log.debug('this is a change file event\n', 'path: ' + path + '\n', stats);
                        this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
                    }
                }).on('unlink', (path) => {
                    this.log.debug('unlink (delete) event\n', 'path: ' + path);
                    this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
                }).on('unlinkDir', (path) => {
                    this.log.debug('unlinkDir (delete folder) event\n', 'path: ' + path);
                    this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
                }).on('error', (error) => {
                    this.log.error('Watcher error: ' + error);
                });
            });
            // Save the watchers in a map so that they can be removed later if wanted.
            this.watchers.set(dir, watcher);
            this.log.debug('A new watcher has been set for the following path: ' + dir);
        } else {
            this.log.debug('A watcher has already been set for this path: ' + dir);
        }
    }

    /**
     * Stop watching a directory found at the given path.
     */
    unwatchDir(path: string) {
        const watcher = this.watchers.get(path);
        if (watcher) {
            watcher.close();
            this.watchers.delete(path);
            this.log.debug('The watcher at the following path has been removed: ' + path);
        } else {
            this.log.debug('There is no watcher to be removed for the given path: ' + path);
        }
    }

    /**
     * Watches a give path, that should represent a file, for modifications.
     * Please use forward slashes (/) instead of backward slashes in the path/filename
     */
    watchFile(path: string, callback: { formname: string; script: string }) {
        this.waitForDefered(() => {
            this.fs.watchFile(path, (curr, prev) => {
                if (curr.mtime !== prev.mtime)
                    this.servoyService.executeInlineScript(callback.formname, callback.script, [path]);
            });
        });
    }

    /**
     * Removes the watch to the file that was added by the watchFile() function.
     * Please use forward slashes (/) instead of backward slashes in the path/filename
     */
    unwatchFile(path: string) {
        this.fs.unwatchFile(path);
    }

    /**
     * Writes the given bytes to the path, if the path has sub directories that are not there
     * then those are made. If the path is missing or contain only the file name then the
     * native system dialog for saving files it is called.
     * When finish, the optional callback it is called on finish with the written path or 'error' string values.
     * An optional passThru object is also passed back to the callback function;
     * Please use forward slashes (/) instead of backward slashes in the path/filename
     */
    writeFile(_path: string, _bytes: any, callback: { formname: string; script: string }, passthru: any) {
        // empty impl, is implemented in server side api calling the impl method below.
    }

    writeFileImpl(path: string, url: string, key: string) {
        this.waitForDefered(() => {
            this.defer = new Deferred();
            path = (path != null) ? path : '';
            let dir = path;
            const index = path.lastIndexOf('/');
            if (index >= 0) {
                dir = path.substring(0, index);
                this.saveUrlToPath(dir, path, url, key);
            } else {
                const options = {
                    title: 'Save file',
                    defaultPath: path,
                    buttonLabel: 'Save'
                };
                this.dialog.showSaveDialog(this.remote.getCurrentWindow(), options)
                    .then((result) => {
                        if (!result.canceled) {
                            const realPath = result.filePath.replace(/\\/g, '/'); //on Windows the path contains backslash
                            const indexOf = realPath.lastIndexOf('/');
                            if (indexOf > 0) {
                                dir = realPath.substring(0, indexOf);
                                this.saveUrlToPath(dir, realPath, url, key);
                            } else {
                                this.defer.resolve(false);
                                this.defer = null;
                            }
                        } else {
                            this.defer.resolve(true);
                            this.defer = null;
                        }
                    }).catch((err) => {
                        this.log.info(err);
                        this.defer.resolve(false);
                        this.defer = null;
                    });
            }
        });
    }

    /**
     * Reads and returns the content of the given file
     *
     * @param {String} path
     */
    readFileSync(path: string) {
    }

    readFileSyncImpl(path: string, id: string) {
        const syncDefer = new Deferred<boolean>();
        this.readFileImpl(path, id, syncDefer);
        return syncDefer.promise;
    }

    /**
     * Reads the given bytes of a path, the callback is a function that will get as parameters the 'path' as a String and the 'file' as a JSUpload object
     * If the path is missing or contain only the file name then the native system dialog for opening files it is called.
     * Please use forward slashes (/) instead of backward slashes in the path/filename
     *
     */
    readFile(_callback: { formname: string; script: string }, _path: string) {
        // empty impl, is implemented in server side api calling the impl method below.
    }

    readFileImpl(path: string, id: string, syncDefer: Deferred<boolean>) {
        this.waitForDefered(() => {
            path = (path != null) ? path : '';
            if (path.lastIndexOf('/') >= 0) {
                this.readUrlFromPath(path, id, syncDefer);
            } else {
                const options = {
                    title: 'Open file',
                    defaultPath: path,
                    buttonLabel: 'Open'
                };
                this.dialog.showOpenDialog(this.remote.getCurrentWindow(), options)
                    .then((result) => {
                        if (!result.canceled) {
                            this.readUrlFromPath(result.filePaths[0].replace(/\\/g, '/'), id, syncDefer); //on Windows the path contains backslash
                        }
                    }).catch((err) => {
                        this.log.info(err);
                    });
            }
        });
    }

    /**
     * Select a folder and pass its path to the callback.
     */
    selectDirectory(callback: { formname: string; script: string }) {
        this.waitForDefered(() => {
            const options: electron.OpenDialogOptions = {
                title: 'Select folder',
                buttonLabel: 'Select',
                properties: ['openDirectory']
            };
            this.dialog.showOpenDialog(this.remote.getCurrentWindow(), options)
                .then((result) => {
                    if (!result.canceled) {
                        this.servoyService.executeInlineScript(callback.formname, callback.script, [result.filePaths[0]]);
                    }
                }).catch((err) => {
                    this.log.info(err);
                });
        });
    }

    /**
    * Return the selected folder.
    *
    * @param path: initial path
    */
    selectDirectorySync( path: string ) {
        const selDirDefer = new Deferred();
        this.waitForDefered(() => {
            const options: electron.OpenDialogOptions = {
                title: 'Select folder',
                ...(path != null) && ({defaultPath: path}),
                buttonLabel: 'Select',
                properties: ['openDirectory']
            };
            this.dialog.showOpenDialog(this.remote.getCurrentWindow(), options)
                .then((result) => {
                    if (!result.canceled) {
                       selDirDefer.resolve(result.filePaths[0]);
                    } else {
                        selDirDefer.resolve(null);
                    }
                }).catch((err) => {
                    this.log.info(err);
                    selDirDefer.resolve(null);
                });
        });
        return selDirDefer.promise;
    }

    /**
    * Return the selected file.
    *
    * @param path: initial path
    */
     selectFileSync( path: string ) {
        const selFileDefer = new Deferred();
        this.waitForDefered(() => {
            const options: electron.OpenDialogOptions = {
                title: 'Select file',
                ...(path != null) && ({defaultPath: path}),
                buttonLabel: 'Select',
                properties: ['openFile']
            };
            this.dialog.showOpenDialog(this.remote.getCurrentWindow(), options)
                .then((result) => {
                    if (!result.canceled) {
                       selFileDefer.resolve(result.filePaths[0].replace(/\\/g, '/'));
                    } else {
                        selFileDefer.resolve(null);
                    }
                }).catch((err) => {
                    this.log.info(err);
                    selFileDefer.resolve(null);
                });
        });
        return selFileDefer.promise;
    }

    /**
     * Shows a file save dialog and calls the callback method with the file path
     *
     * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogbrowserwindow-options
     *
     * @param callback
     * @param [options]
     *
     * Core options are
     *
     * title: String the dialog title
     * defaultPath: String - absolute directory path, absolute file path, or file name to use by default.
     * buttonLabel: String - custom label for the confirmation button, when left empty the default label will be used.
     * filters: Array<{name: String, extensions: Array<String>}> - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
     */
    showSaveDialog(callback: { formname: string; script: string }, options: electron.SaveDialogSyncOptions) {
        this.waitForDefered(() => {
            if (!options) {
                options = {};
            }
            this.dialog.showSaveDialog(this.remote.getCurrentWindow(), options)
                .then((result) => {
                    if (!result.canceled) {
                        this.servoyService.executeInlineScript(callback.formname, callback.script, [result.filePath]);
                    }
                }).catch((err) => {
                    this.log.info(err);
                });
        });
    }

    /**
     * Shows a file save dialog
     *
     * To not block any process, showSaveDialog with a callback method is preferred over this method
     *
     * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogsyncbrowserwindow-options
     *
     * @param [options]
     *
     * Core options are
     *
     * title: String the dialog title
     * defaultPath: String - absolute directory path, absolute file path, or file name to use by default.
     * buttonLabel: String - custom label for the confirmation button, when left empty the default label will be used.
     * filters: Array<{name: String, extensions: Array<String>}> - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
     *
     * @return
     */
    showSaveDialogSync(options: electron.SaveDialogSyncOptions) {
        try {
            return this.dialog.showSaveDialogSync(this.remote.getCurrentWindow(), options);
        } catch (e) {
            this.log.info(e);
        }
        return null;
    }

    /**
     * Shows a file open dialog and calls the callback with the selected file path(s)
     *
     * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowopendialogbrowserwindow-options
     *
     * Core options are
     *
     * title: String the dialog title
     * defaultPath: String the default (starting) path
     * buttonLabel: String custom label for the confirmation button, when left empty the default label will be used.
     * filters: Array<{name: String, extensions: Array<String>}> an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
     * properties: an Array of property keywords such as
     *  <code>openFile</code> - Allow files to be selected.
     *  <code>openDirectory</code> - Allow directories to be selected.
     *  <code>multiSelections</code> - Allow multiple paths to be selected.
     *
     * @param callback
     * @param [options]
     */
    showOpenDialog(callback: { formname: string; script: string }, options: electron.OpenDialogOptions) {
        this.waitForDefered(() => {
            if (!options) {
                options = {};
            }
            this.dialog.showOpenDialog(this.remote.getCurrentWindow(), options)
                .then((result) => {
                    if (!result.canceled) {
                        this.servoyService.executeInlineScript(callback.formname, callback.script, [result.filePaths]);
                    }
                }).catch((err) => {
                    this.log.info(err);
                });
        });
    }

    /**
     * Shows a file open dialog and returns the selected file path(s)
     *
     * To not block any process, showOpenDialog with a callback method is preferred over this method
     *
     * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowopendialogsyncbrowserwindow-options
     *
     * Core options are
     *
     * title: String the dialog title
     * defaultPath: String the default (starting) path
     * buttonLabel: String custom label for the confirmation button, when left empty the default label will be used.
     * filters: Array<{name: String, extensions: Array<String>}> an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
     * properties: an Array of property keywords such as
     *  <code>openFile</code> - Allow files to be selected.
     *  <code>openDirectory</code> - Allow directories to be selected.
     *  <code>multiSelections</code> - Allow multiple paths to be selected.
     *
     * @param [options]
     * @return <Array<String>}
     */
    showOpenDialogSync(options: electron.OpenDialogSyncOptions) {
        try {
            return this.dialog.showOpenDialogSync(this.remote.getCurrentWindow(), options);
        } catch (e) {
            this.log.info(e);
        }
        return null;
    }

    /**
     * Delete the given file, returning a boolean indicating success or failure
     *
     * @param path
     * @return
     */
    deleteFileSync(path: string) {
        const deleteDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            this.fs.unlink(path, (err) => {
                this.resolveBooleanDefer(err, deleteDefer);
            });
            this.defer.resolve(null);
            this.defer = null;
        });
        return deleteDefer.promise;
    }

    /**
     * Deletes the given file, optionally calling the error callback when unsuccessful
     *
     * @param path
     * @param [errorCallback]
     */
    deleteFile(path: string, errorCallback: { formname: string; script: string }) {
        this.waitForDefered(() => {
            this.defer = new Deferred();
            this.fs.unlink(path, (err) => {
                if (err && errorCallback) this.servoyService.executeInlineScript(errorCallback.formname, errorCallback.script, [err]);
            });
            this.defer.resolve(null);
            this.defer = null;
        });
    }


    /**
     * Return a 'stats' object containing related file's information's.
     * Please use forward slashes (/) instead of backward slashes in the path
     *
     * @return
     */
    getFileStats(path: string) {
        const statsDefer = new Deferred();
        this.waitForDefered(() => {
            if (!this.fs.existsSync(path)) {
                statsDefer.resolve(null);
            } else try {
                this.fs.lstat(path, (err, stats) => {
                    if (err) throw err;
                    if (stats.isSymbolicLink()) {//this method is valid only when calling fs.lstat() (NOT fs.stat())
                        statsDefer.resolve(this.getStatsValues(stats));
                    } else {
                        this.fs.stat(path, (error, stats2) => {
                            if (error) throw error;
                            statsDefer.resolve(this.getStatsValues(stats2));
                        });
                    }
                });
            } catch (err) {
                statsDefer.resolve(null);
                console.error(err);
            }
        });
        return statsDefer.promise;
    }

    /**
     * Opens a file specified at the given path.
     * It returns a string value.
     * If the value is empty, then the file has been successfully opened, otherwise the string contains the error message.
     *
     * @param path - file's full path
     * @return
     */
    openFile(path: string) {
        return this.waitForDefered(() => this.shell.openPath(path));
    }

    /**
     * Test whether or not the given path exists by checking with the file system.
     * It returns true if the path exists, false otherwise.
     *
     * @param path - file's full path
     * @return
     */
    exists(path: string) {
        const existsDefer = new Deferred();
        this.waitForDefered(() => {
            try {
                if (path) {
                    existsDefer.resolve(this.fs.existsSync(path));
                }
            } catch (err) {
                existsDefer.resolve(false);
            }
        });
        return existsDefer.promise;
    }

    /**
     * Synchronously append data to a file, creating the file if it does not yet exist.
     *
     * @param path - file's full path
     * @param text - text to be added
     * @param [encoding] - default utf8
     * @return
     */
    appendToTXTFile(path: string, text: string, encoding: string) {
        const appendDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            const enc: WriteFileOptions = encoding as WriteFileOptions || null;
            if (path && text) {
                this.fs.appendFile(path, text, enc, (err) => {
                    this.resolveBooleanDefer(err, appendDefer);
                });
            } else {
                appendDefer.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return appendDefer.promise;
    }

    /**
     * Synchronously copies src to dest. By default, dest is overwritten if it already exists.
     *
     * @param src - source filepath to copy
     * @param dest - destination filepath of the copy operation
     * @param [overwriteDest] - default true
     * @return
     */
    copyFile(src: string, dest: string, overwriteDest: boolean) {
        const copyDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            const mode = (overwriteDest === false) ? 1 : 0;
            if (src && dest) {
                this.fs.copyFile(src, dest, mode, (err) => {
                    this.resolveBooleanDefer(err, copyDefer);
                });
            } else {
                copyDefer.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return copyDefer.promise;
    }


    /**
     * Synchronously creates a folder, including any necessary but nonexistent parent folders.
     *
     * @param path - folders full path
     * @return
     */
    createFolder(path: string) {
        const createDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            if (path) {
                this.fs.mkdir(path, { recursive: true }, (err) => {
                    this.resolveBooleanDefer(err, createDefer);
                });
            } else {
                createDefer.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return createDefer.promise;
    }


    /**
     * Synchronously deletes a folder, fails when folder is not empty
     *
     * @param path - folders full path
     * @return
     */
    deleteFolder(path: string) {
        const deleteDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            if (path) {
                this.fs.rmdir(path, (err) => {
                    this.resolveBooleanDefer(err, deleteDefer);
                });
            } else {
                deleteDefer.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return deleteDefer.promise;
    }

    /**
     * Synchronously rename file at oldPath to the pathname provided as newPath. In the case that newPath already exists, it will be overwritten.
     *
     * @param oldPath - old file full path
     * @param newPath - new file full path
     *
     * @return
     */
    renameFile(oldPath: string, newPath: string) {
        const renameDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            this.fs.rename(oldPath, newPath, (err) => {
                this.resolveBooleanDefer(err, renameDefer);
            });
            this.defer.resolve(null);
            this.defer = null;
        });
    }

    /**
     * Writes text to the given path/filename
     *
     * @param path
     * @param text_data
     * @param [encoding] optional, default 'utf8'
     *
     * @return
     */
    writeTXTFileSync(path: string, text_data: string, encoding: BufferEncoding) {
        const writeDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            text_data = text_data || '';
            const options: fs.WriteFileOptions = { encoding: 'utf8' };
            if (encoding) {
                options.encoding = encoding;
            }
            if (path) {
                this.fs.writeFile(path, text_data, options, (err) => {
                    this.resolveBooleanDefer(err, writeDefer);
                });
            } else {
                writeDefer.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return writeDefer.promise;
    }


    /**
     * Reads and returns the text of the given path/filename
     *
     * @param path
     * @param [encoding] optional, default 'utf8'
     *
     * @return
     */
    readTXTFileSync(path: string, encoding: BufferEncoding) {
        const readDefer = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            const options: fs.ObjectEncodingOptions = { encoding: 'utf8' };
            if (encoding) {
                options.encoding = encoding;
            }
            if (path) {
                this.fs.readFile(path, options, (err, data) => {
                    if (err) {
                        readDefer.resolve(null);
                        console.error(err);
                    } else {
                        readDefer.resolve(data);
                    }
                });
            } else {
                readDefer.resolve(null);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return readDefer.promise;
    }

    /**
     * Set permisions to the specified file.
     * If readOnly parameter is false, the file permisions flags will be set to read/write mod*
     *
     * @param path - file path
     *
     * @return
     */
    setReadOnly(path: string, flag: boolean) {
        const deferRO = new Deferred();
        this.waitForDefered(() => {
            this.defer = new Deferred();
            if (path) {
                if (flag) {
                    this.fs.chmod(path, 0o444, (err) => {
                        this.resolveBooleanDefer(err, deferRO);
                    });
                } else {
                    this.fs.chmod(path, 0o644, (err) => {
                        this.resolveBooleanDefer(err, deferRO);
                    });
                }
            } else {
                deferRO.resolve(false);
            }
            this.defer.resolve(null);
            this.defer = null;
        });
        return deferRO.promise;
    }

    /**
     * Verify readonly status on the specified path. Returns true for readonly otherwise false
     *
     * @param path - directory's full path
     *
     * @return
     */
    getReadOnly(path: string) {
        const deferRO = new Deferred();
        this.waitForDefered(() => {
            try {
                this.fs.lstat(path, (err, stats) => {
                    if (err) throw err;
                    if (stats.isSymbolicLink()) {//this method is valid only when calling fs.lstat() (NOT fs.stat())
                        deferRO.resolve(this.isReadOnly(stats.mode));
                    } else {
                        this.fs.stat(path, (error, stats2) => {
                            if (error) throw error;
                            deferRO.resolve(this.isReadOnly(stats2.mode));
                        });
                    }
                });
            } catch (err) {
                deferRO.resolve(false);
                console.error(err);
            }
        });
        return deferRO.promise;
    }


    private getFullUrl(url: string) {
        let base = document.baseURI;
        if (!base.endsWith('/')) base = base + '/';
        return base + url;
    }

    private saveUrlToPath(dir: string, realPath: string, url: string, key: string) {
        this.fs.mkdir(dir, { recursive: true }, (err) => {
            if (err) {
                this.defer.resolve(false);
                this.defer = null;
                throw err;
            } else {
                let fileSize = 0;
                let writeSize = 0;
                let writer = null;

                const request = this.net.request({
                    url: this.getFullUrl(url),
                    session: this.remote.getCurrentWebContents().session,
                    useSessionCookies: true
                }) as electron.ClientRequest;

                request.on('response', (response) => {
                    fileSize = parseInt(response.headers['content-length'] as string, 10);
                    writer = this.fs.createWriteStream(realPath);
                    response.on('data', (chunk) => {
                        writeSize = writeSize + chunk.length;
						writer.write(chunk);

						if (writeSize === fileSize) {
                            writer.close();
                            this.servoyService.callServiceServerSideApi('ngdesktopfile','writeCallback',[realPath, key]);
							this.defer.resolve(true);
							this.defer = null;
						}
                    });
                });

                request.on('error', (error) => {
                    if (error) {
                        if ( writer != null ) {
                            writer.close();
                        }
                        this.servoyService.callServiceServerSideApi('ngdesktop','writeCallback',['error', key]);
                        if (this.defer != null) {
                            this.defer.resolve(false); //global defer
                            this.defer = null;
                        }
                        if (error) {
                            throw error;
                        }
                    }
                });

                request.setHeader('Content-Type', 'application/json');
                request.end();
            }
        });
    }

    private readUrlFromPath(path: string, id: string, syncDefer:  Deferred<boolean>) {
        const form = new this.formData();

        form.append('path', path);
        form.append('id', id);
        const reader = this.fs.createReadStream(path, { highWaterMark: 8192 * 1024 });
        form.append('file', reader); //internal buffer size
        const fullUrl = this.getFullUrl(this.servoyService.generateServiceUploadUrl('ngdesktopfile', 'readCallback'));

        const request = this.net.request({
            method: 'POST',
            url: fullUrl,
            session: this.remote.getCurrentWebContents().session,
            useSessionCookies: true
        }) as electron.ClientRequest;
        const headers = form.getHeaders();
        request.setHeader('content-type', headers['content-type']);
        form.pipe(request);
        request.on('error', (err) => {
            if (err) throw err;
        });
        reader.on('end', () => {
            if (syncDefer) {
                setTimeout(() => {
                    syncDefer.resolve(true);
                }, 100);
            }
        });
    }

    private resolveBooleanDefer(err, localDefer) {
        if (err) {
            localDefer.resolve(false);
            console.error(err);
        } else {
            localDefer.resolve(true);
        }
    }

    private getStatsValues(fsStats) {
        const retStats = {
            isBlockDevice: fsStats.isBlockDevice(),
            isCharacterDevice: fsStats.isCharacterDevice(),
            isDirectory: fsStats.isDirectory(),
            isFIFO: fsStats.isFIFO(),
            isFile: fsStats.isFile(),
            isSocket: fsStats.isSocket(),
            isSymbolicLink: fsStats.isSymbolicLink(),
            dev: fsStats.dev,
            ino: fsStats.ino,
            mode: fsStats.mode,
            nlink: fsStats.nlink,
            uid: fsStats.uid,
            gid: fsStats.gid,
            rdev: fsStats.rdev,
            size: fsStats.size,
            blksize: fsStats.blksize,
            blocks: fsStats.blocks,
            atimeMs: fsStats.atimeMs,
            mtimeMs: fsStats.mtimeMs,
            ctimeMs: fsStats.ctimeMs,
            birthtimeMs: fsStats.birthtimeMs
        };
        return retStats;
    }

    private isReadOnly(mode: number) {
        switch (mode) {
            case 33060:     // r--r--r--
            case 33056:     // r--r-----
            case 33024:     // r--------
                return true;;
            default:
                return false;
        }
    }
}

