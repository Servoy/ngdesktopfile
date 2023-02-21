angular.module('ngdesktopfile',['servoy'])
.factory("ngdesktopfile",function($services, $q, $window,$utils, $log) 
{
	var fs = null;
	var session = null;
	var dialog = null;
	var remote = null;
	var watchers = new Map();
	var shell = null;
	var defer = null;
    var syncDefer = null;
	var net = null;
	var formData = null;
	
	if (typeof require == "function") {
		fs = require('fs');
		chokidar = require('chokidar');
		remote = require('@electron/remote');
		shell = require('electron').shell;
		session = remote.session;
		dialog = remote.dialog;
		net = remote.net;
		formData = require('form-data');
	}
	if (fs) {
		function resolveBooleanDefer(err, localDefer) {
			if (err) {
				localDefer.resolve(false);
				console.error(err);
			} else {
				localDefer.resolve(true);
			}
		}
		function getStatsValues(fsStats) {
			var retStats = {
				"isBlockDevice": fsStats.isBlockDevice(),
				"isCharacterDevice": fsStats.isCharacterDevice(),
				"isDirectory": fsStats.isDirectory(),
				"isFIFO": fsStats.isFIFO(),
				"isFile": fsStats.isFile(),
				"isSocket": fsStats.isSocket(),
				"isSymbolicLink": fsStats.isSymbolicLink(),
				"dev": fsStats.dev,
				"ino": fsStats.ino,
				"mode": fsStats.mode,
				"nlink": fsStats.nlink,
				"uid": fsStats.uid,
				"gid": fsStats.gid,
				"rdev": fsStats.rdev,
				"size": fsStats.size,
				"blksize": fsStats.blksize,
				"blocks": fsStats.blocks,
				"atimeMs": fsStats.atimeMs,
				"mtimeMs": fsStats.mtimeMs,
				"ctimeMs": fsStats.ctimeMs,
				"birthtimeMs": fsStats.birthtimeMs
			};
			return retStats;
		}
		function getFullUrl(url) {
			var base = document.baseURI;
			if (!base.endsWith("/")) base = base + "/";
			return base + url;
		}
		function isReadOnly(mode) {
			switch (mode) {
				case 33060: 	// r--r--r--
				case 33056:		// r--r-----
				case 33024: 	// r--------
					return true;;
				default:
					return false; 
			}
		}
		function waitForDefered(func) {
			if (defer != null) {
				return defer.promise.then(function(){
					return waitForDefered(func); //avoid multiple calls to the same defer to be executed concurently
				})
			}
			else func();
		}
		function invokeCallback(callback, message) {
			if (callback) {
				$window.executeInlineScript(callback.formname, callback.script, [message]);
				return true;
			}
			return false;
		}
		return {
			waitForDefered: function(func) {
				waitForDefered(func);
			},
			/**
			 * Returns the home dir of the user like c:/users/[username] under windows.
			 * Will return always a both with forward slashes.
			 */
			homeDir: function() {
				return require('os').homedir().replace(/\\/g, "/");
			},
			/**
			 * Returns the tmp directory of the client machine.
			 * Will return always a both with forward slashes.
			 */
			tmpDir: function() {
				return require('os').tmpdir().replace(/\\/g, "/");
			},
			/**
			 * returns an array of filenames that are in the given path. 
			 * Please use forward slashes (/) instead of backward slashes.
			 */
			listDir: function(path) {
				const listDefer = $q.defer();
				waitForDefered(function() {
					fs.readdir(path, function(error, files) {
						listDefer.resolve(files);
					})
				})
				return listDefer.promise;
			},
			/**
			 * Watches a directory for changes at the given path. 
			 * 
			 * @param path - directory's full path
			 * @param callback - the callback method to be executed
			 */
			watchDir: function(path, callback) {
				 /** Please check the below used library here: https://github.com/paulmillr/chokidar
					 * add, addDir, change, unlink, unlinkDir these are all events. 
					 * add is for adding file
					 * addDir is for adding folders
					 * unlink is for deleting files
					 * unlinkDir is for delete folders
					 * change is for changing files **/
				if (!watchers.get(path)) {
					// Initialize watcher
					const watcher = chokidar.watch(path, {
					  ignoreInitial: true,
					  alwaysStat: true
					});
					waitForDefered(function() {
						watcher.on('add', function(path, stats) {
							$log.debug('this is an add event\n', 'path: ' + path + '\n', stats)
							$window.executeInlineScript(callback.formname, callback.script, [path]);
						}).on('addDir', function(path, stats) {
							$log.debug('this is an addDir event\n', 'path: ' + path + '\n', stats)
							$window.executeInlineScript(callback.formname, callback.script, [path]);
						}).on('change', function(path, stats) {
							// For MacOS: Do not make the callback when .DS_Store is changed. 
							// DS_Store is a file that stores custom attributes of its containing folder,
							// such as the position of icons or the choice of a background image
							if (!path.includes(".DS_Store")) {
								$log.debug('this is a change file event\n', 'path: ' + path + '\n', stats)
								$window.executeInlineScript(callback.formname, callback.script, [path]);
							}
						}).on('unlink', function(path) {
							$log.debug('unlink (delete) event\n', 'path: ' + path)
							$window.executeInlineScript(callback.formname, callback.script, [path]);
						}).on('unlinkDir', function(path) {
							$log.debug('unlinkDir (delete folder) event\n', 'path: ' + path);
							$window.executeInlineScript(callback.formname, callback.script, [path]);
						}).on('error', function(error) {
							$log.error('Watcher error: ' + error);
						});
					});
					// Save the watchers in a map so that they can be removed later if wanted. 
					watchers.set(path, watcher);
					$log.debug('A new watcher has been set for the following path: ' + path);
				} else {
					$log.debug('A watcher has already been set for this path: ' + path);
				}
			},
			/**
			 * Stop watching a directory found at the given path.
			 */
			unwatchDir: function(path) {
				const watcher = watchers.get(path);
				if (watcher) {
					watcher.close();
					watchers.delete(path);
					$log.debug('The watcher at the following path has been removed: ' + path);
				} else {
					$log.debug('There is no watcher to be removed for the given path: ' + path);
				}
			},
			/**
			 * Watches a give path, that should represent a file, for modifications.
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 */
			watchFile: function(path, callback) {
				waitForDefered(function() {
					fs.watchFile(path, function(curr, prev) {
						  if (curr.mtime != prev.mtime)
						  	$window.executeInlineScript(callback.formname, callback.script, [path]);
					});
				})
			},
			/**
			 * Removes the watch to the file that was added by the watchFile() function.
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 */
			unwatchFile: function(path) {
				fs.unwatchFile(path);
			},
			/**
			 * Writes the given bytes to the path, if the path has sub directories that are not there 
			 * then those are made. If the path is missing or contain only the file name then the  
			 * native system dialog for saving files it is called.
			 * When finish, the optional callback it is called on finish with 'close' or 'error' string values
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 */
			writeFile: function(path, bytes, callback) {
				// empty impl, is implemented in server side api calling the impl method below.
			},
			writeFileImpl: function(path, url, callback) {
				waitForDefered(function() {
					function saveUrlToPath(dir, realPath) {
					    fs.mkdir(dir, { recursive: true }, function(err) {
					    	if (err) {
					    		defer.resolve(false);
								defer = null;
								throw err;
					    	}
					    	else {
								var fileSize = 0;
								var writeSize = 0;
								var writer = null;
								const request = net.request(
									{
										url: getFullUrl(url),
										session: remote.getCurrentWebContents().session,
										useSessionCookies: true	
									}
								 );
								
								request.on('response', (response) => {
									fileSize = parseInt(response.headers['content-length'], 10);
									writer = fs.createWriteStream(realPath);
									response.on('data', (chunk) => {
										writeSize = writeSize + chunk.length;
										writer.write(chunk);
									
										if (writeSize === fileSize) {
											writer.close();
											invokeCallback(callback, 'close');

											defer.resolve(true);
											defer = null;
										}
									});
								});
								
								request.on('error', (err) => {//called only for network error
									if ( writer != null) {
										writer.close();
									}
									invokeCallback(callback, 'error');	
									if (defer != null) {
										defer.resolve(false); 
										defer = null;
									}
									if (err) {
										errorReceived = true;
										throw err;
									}
								});

								request.setHeader('Content-Type', 'application/json');
								request.end();
					    	}
						});
					}
					defer = $q.defer();
					path = (path != null) ? path : "";
				    var dir = path;
				    var index = path.lastIndexOf("/");
				    if (index >= 0) {
				    	dir = path.substring(0,index);
				    	saveUrlToPath(dir, path);
				    } else {
				    	var options = {
			                title: "Save file",
			                defaultPath : path,
			                buttonLabel : "Save"
			               }
				    	dialog.showSaveDialog(remote.getCurrentWindow(), options)
						.then(function(result) {
				    		 if (!result.canceled) {
				    			 var realPath = result.filePath.replace(/\\/g, "/"); //on Windows the path contains backslash
					    		 var index = realPath.lastIndexOf("/");
								 if (index > 0) {
								 	dir = realPath.substring(0,index);
								    saveUrlToPath(dir,realPath);
								 } else {
									defer.resolve(false);
									defer = null;
								 }
				    		 } else {
				    			defer.resolve(true);
								defer = null;
				    		 }
				    	}).catch(function(err) {
				    		console.log(err);
				    		defer.resolve(false);
							defer = null;
				    	});
				    }
				})
			},
             /**
			 * Reads and returns the content of the given file
			 * 
			 * @param {String} path
			 * 
			 * @return {JSUpload}
 			 */
             readFileSync: function(path) {
            },
            readFileSyncImpl: function(path, id) {
                syncDefer = $q.defer();
                this.readFileImpl(path, id, syncDefer);
                return syncDefer.promise;
            },
			/**
			 * Reads the given bytes of a path, the callback is a function that will get as parameters the 'path' as a String and the 'file' as a JSUpload object
			 * If the path is missing or contain only the file name then the native system dialog for opening files it is called.
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 * 
			 */
			readFile: function(callback, path) {
				// empty impl, is implemented in server side api calling the impl method below.
			},
			readFileImpl: function(path, id, syncDefer) {
				waitForDefered(function() {
					function readUrlFromPath(path, id) {
						var form = new formData();
                        var reader = fs.createReadStream(path, {highWaterMark : 8192 * 1024});//internal buffer size
						form.append('path', path);
						form.append('id', id);
						form.append('file', reader); 
						var fullUrl = getFullUrl($utils.generateServiceUploadUrl("ngdesktopfile", "callback"));
                        console.log(fullUrl);

						const request = net.request({
                            method: 'POST',
							url: fullUrl,
							session: remote.getCurrentWebContents().session,
							useSessionCookies: true
						});
						var headers = form.getHeaders();
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
                        })
					}
					
					path = (path != null) ? path : "";
					if (path.lastIndexOf("/") >= 0) {
						readUrlFromPath(path, id)
					} else {
						var options = {
			                title: "Open file",
			                defaultPath : path,
			                buttonLabel : "Open"
			            }
						dialog.showOpenDialog(remote.getCurrentWindow(), options)
						.then(function(result) {
							if (!result.canceled) {
								readUrlFromPath(result.filePaths[0].replace(/\\/g, "/"), id); //on Windows the path contains backslash
							} 
						}).catch(function(err) {
							console.log(err);
						})
					}					
				})
			},
			/**
			 * Select a folder and pass its path to the callback.
			 */
			selectDirectory: function(callback) {
				waitForDefered(function() {
					var options = {
							title: "Select folder",
							buttonLabel : "Select",
							properties: ['openDirectory']
					}
					dialog.showOpenDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							$window.executeInlineScript(callback.formname, callback.script, [result.filePaths[0]])
						} 
					}).catch(function(err) {
						console.log(err);
					})
				})
			},

			/**
			* Return the selected folder.
			*/
			selectDirectorySync( path ) {
				const selDirDefer = $q.defer();
				waitForDefered(function() {
					var options = {
							title: "Select folder",
							...(path != null) && ({defaultPath: path}),
							buttonLabel : "Select",
							properties: ['openDirectory']
					}
					dialog.showOpenDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							selDirDefer.resolve(result.filePaths[0]);
						} else {
							selDirDefer.resolve(null);
						}
					}).catch(function(err) {
						console.log(err);
						selDirDefer.resolve(null);
					})
				});
				return selDirDefer.promise;
			},
				
			/**
			 * Return the selected file.
			 */
			selectFileSync( path ) {
				const selFileDefer = $q.defer();
				waitForDefered(function() {
					var options = {
							title: "Select file",
							...(path != null) && ({defaultPath: path}),
							buttonLabel : "Select",
							properties: ['openFile']
					}
					dialog.showOpenDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							selFileDefer.resolve(result.filePaths[0]);
						} else {
							selFileDefer.resolve(null);
						}
					}).catch(function(err) {
						console.log(err);
						selFileDefer.resolve(null);
					})
				});
				return selFileDefer.promise;
			},

			/**
			 * Shows a file save dialog and calls the callback method with the file path
			 * 
			 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogbrowserwindow-options
			 * 
			 * @param {Function} callback
			 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=}} [options]
			 * 
			 * Core options are
			 * 
			 * title: String the dialog title
			 * defaultPath: String - absolute directory path, absolute file path, or file name to use by default.
			 * buttonLabel: String - custom label for the confirmation button, when left empty the default label will be used.
			 * filters: Array<{name: String, extensions: Array<String>}> - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
			 */
			showSaveDialog: function(callback, options) {
				waitForDefered(function() {
					if (!options) {
						options = {};
					}
					dialog.showSaveDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							$window.executeInlineScript(callback.formname, callback.script, [result.filePath])
						} 
					}).catch(function(err) {
						console.log(err);
					})
				})
			},
			/**
			 * Shows a file save dialog
			 * 
			 * To not block any process, showSaveDialog with a callback method is preferred over this method
			 * 
			 * For the options object see https://www.electronjs.org/docs/api/dialog#dialogshowsavedialogsyncbrowserwindow-options
			 * 
			 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=}} [options]
			 * 
			 * Core options are
			 * 
			 * title: String the dialog title
			 * defaultPath: String - absolute directory path, absolute file path, or file name to use by default.
			 * buttonLabel: String - custom label for the confirmation button, when left empty the default label will be used.
			 * filters: Array<{name: String, extensions: Array<String>}> - an array of file filters (e.g. [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }])
			 * 
			 * @return {String}
			 */
			showSaveDialogSync: function(options) {
                const saveDlgDefer = $q.defer();
                waitForDefered(function() {
                    if (!options) {
						options = {};
					}
                    dialog.showSaveDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							saveDlgDefer.resolve(result.filePath)
						} else {
                            saveDlgDefer.resolve(undefined); //on cancel return undefined: https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogsyncbrowserwindow-options
                        }
					}).catch(function(err) {
						console.log(err);
                        saveDlgDefer.resolve(undefined);
					})
                });
                return saveDlgDefer.promise;
			},
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
			 * 	<code>openFile</code> - Allow files to be selected.
			 * 	<code>openDirectory</code> - Allow directories to be selected.
			 *  <code>multiSelections</code> - Allow multiple paths to be selected.
			 * 
			 * @param {Function} callback
			 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=, properties: Array<String>}} [options] 
			 */
			showOpenDialog: function(callback, options) {
				waitForDefered(function() {
					if (!options) {
						options = {};
					}
					dialog.showOpenDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							$window.executeInlineScript(callback.formname, callback.script, [result.filePaths])
						} 
					}).catch(function(err) {
						console.log(err);
					})
				})
			},
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
			 * 	<code>openFile</code> - Allow files to be selected.
			 * 	<code>openDirectory</code> - Allow directories to be selected.
			 *  <code>multiSelections</code> - Allow multiple paths to be selected.
			 * 
			 * @param {{title: String=, defaultPath: String=, buttonLabel: String=, filters: Array<{name: String, extensions: Array<String>}>=, properties: Array<String>}} [options]
			 * @return <Array<String>}  
			 */
			showOpenDialogSync: function(options) {
                const openDlgDefer = $q.defer();
                waitForDefered(function() {
                    if (!options) {
						options = {};
					}
                    dialog.showOpenDialog(remote.getCurrentWindow(), options)
					.then(function(result) {
						if (!result.canceled) {
							openDlgDefer.resolve(result.filePaths)
						} else {
                            openDlgDefer.resolve(undefined);
                        }
					}).catch(function(err) {
						console.log(err);
                        openDlgDefer.resolve(undefined);
					})
                })
                return openDlgDefer.promise;
			},
			/**
			 * Delete the given file, returning a boolean indicating success or failure
			 * @param {String} path
			 * @return {boolean}
			 */
			 deleteFileSync: function(path) {
				const deleteDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					fs.unlink(path, function(err) {
						resolveBooleanDefer(err,deleteDefer);
					});
					defer.resolve(null);
					defer = null;
				});
				return deleteDefer.promise;
			},

			/**
			 * Deletes the given file, optionally calling the error callback when unsuccessful
			 * @param {String} path
			 * @param {Function} [errorCallback]
			 */
			deleteFile: function(path, errorCallback) {
				waitForDefered(function() {
					defer = $q.defer();
					fs.unlink(path, function(err) {
						if (err && errorCallback) $window.executeInlineScript(errorCallback.formname, errorCallback.script, [err]);
					});
					defer.resolve(null);
				defer = null;
				})
			},
			/**
			 * Return a 'stats' object containing related file's information's.
			 * Please use forward slashes (/) instead of backward slashes in the path
			 * 
			 * @return {stats}
			 */
			getFileStats: function(path) {
				const statsDefer = $q.defer();
				waitForDefered(function() {
					if (!fs.existsSync(path)) {//exists is deprecated
						statsDefer.resolve(null);
					} else try {
						fs.lstat(path, function(err, stats) {
							if (err) throw err;
							if (stats.isSymbolicLink()) {//this method is valid only when calling fs.lstat() (NOT fs.stat())
								statsDefer.resolve(getStatsValues(stats))
							} else {
								fs.stat(path, function(err, stats) {
									if (err) throw err;
									statsDefer.resolve(getStatsValues(stats));
								});
							}
						});
					} catch (err) {
						statsDefer.resolve(null);
						console.error(err);
					}
				});
				return statsDefer.promise;
			},
			/**
			 * Opens a file specified at the given path on the client. 
             * This path must exist on the client's machine, you can't open a file with a path pointing to a file on the server, use writeFile() first to write it to the clients machine.
			 * It returns a string value. 
			 * If the value is empty, then the file has been successfully opened, otherwise the string contains the error message.
			 * 
			 * @param {String} path - file's full path
			 * @return {String}
 			 */
			 openFile: function(path) {
				return waitForDefered(function() {
					return shell.openPath(path);
				});
			},
			/**
			 * Test whether or not the given path exists by checking with the file system.
			 * It returns true if the path exists, false otherwise.
			 * 
			 * @param {String} path - file's full path
			 * @return {boolean}
 			 */
			 exists: function(path) {
				const existsDefer = $q.defer();
				waitForDefered(function() {
					if(path) {
						//keep existsSync() since exists() is deprecated and access() must be used with open()/writeFile()/readFIle()
						existsDefer.resolve(fs.existsSync(path));
					} else {
						existsDefer.resolve(false);
					}
				})
				return existsDefer.promise;
			},
			/**
			 * Synchronously append data to a file, creating the file if it does not yet exist.
			 * 
			 * @param {String} path - file's full path
			 * @param {String} text - text to be added
			 * @param {String} [encoding] - default utf8
			 * @return {boolean}
 			 */
			appendToTXTFile: function(path, text, encoding) {
				var appendDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					encoding = encoding || null;
					if(path && text) {
						fs.appendFile(path, text, encoding, function(err) {
							resolveBooleanDefer(err, appendDefer);
						});
					} else {
						appendDefer.resolve(false);
					}
					defer.resolve(null);
					defer = null;
				});	
				return appendDefer.promise;
			},
			/**
			 * Synchronously copies src to dest. By default, dest is overwritten if it already exists.
			 * 
			 * @param {String} src - source filepath to copy
			 * @param {String} dest - destination filepath of the copy operation
			 * @param {Boolean} [overwriteDest] - default true
			 * @return {boolean}
 			 */
			copyFile: function(src, dest, overwriteDest) {
				const copyDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					var mode = (overwriteDest === false) ? 1 : 0; 						
					if(src && dest) {
						fs.copyFile(src, dest, mode, function(err) {
							resolveBooleanDefer(err, copyDefer);
						});
					} else {
						copyDefer.resolve(false);
					}
					defer.resolve(null);
					defer = null;
				});
				return copyDefer.promise;
			},
			/**
			 * Synchronously creates a folder, including any necessary but nonexistent parent folders.
			 * 
			 * @param {String} path - folders full path
			 * @return {boolean}
 			 */
			createFolder: function(path) {
				const createDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					if(path) {
						fs.mkdir(path, { recursive: true }, function(err) {
							resolveBooleanDefer(err, createDefer);
						});
					} else {
						createDefer.resolve(false);
					}
					defer.resolve(null);
					defer = null;
				});
				return createDefer.promise;
			},
			/**
			 * Synchronously deletes a folder, fails when folder is not empty
			 * 
			 * @param {String} path - folders full path
			 * @return {boolean}
 			 */
			deleteFolder: function(path) {
				const deleteDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					if(path) {
						fs.rmdir(path, function(err) {
							resolveBooleanDefer(err, deleteDefer);
						});
					} else {
						deleteDefer.resolve(false);
					}
					defer.resolve(null);
					defer = null;
				});
				return deleteDefer.promise;
			},
			/**
			 * Synchronously rename file at oldPath to the pathname provided as newPath. In the case that newPath already exists, it will be overwritten.
			 * 
			 * @param {String} oldPath - old file full path
			 * @param {String} newPath - new file full path
			 * 
			 * @return {boolean}
 			 */
			renameFile: function(oldPath, newPath) {
				const renameDefer = $q.defer();
				waitForDefered(function () {
					defer = $q.defer();
					fs.rename(oldPath, newPath, function(err) {
						resolveBooleanDefer(err, renameDefer);
					});
					defer.resolve(null);
					defer = null;
				});
			},
			/**
			 * Writes text to the given path/filename
			 * 
			 * @param {String} path
			 * @param {String} text_data
			 * @param {String} [encoding] optional, default 'utf8'
			 * 
			 * @return {boolean}
 			 */
			writeTXTFileSync: function(path, text_data, encoding) {
				const writeDefer = $q.defer();
				waitForDefered(function(){
					defer = $q.defer();
					text_data = text_data || '';
					var options = { encoding:'utf8' };
					if(encoding) {
						options.encoding = encoding;
					}
					if(path) {
						fs.writeFile(path, text_data, options, function(err) {
							resolveBooleanDefer(err, writeDefer);
						});
					} else {
						writeDefer.resolve(false);
					}
					defer.resolve(null);
					defer = null;
				});
				return writeDefer.promise;
			},
			/**
			 * Reads and returns the text of the given path/filename
			 * 
			 * @param {String} path
			 * @param {String} [encoding] optional, default 'utf8'
			 * 
			 * @return {String}
 			 */
			readTXTFileSync: function(path, encoding) {
				const readDefer = $q.defer();
				waitForDefered(function() {
					defer = $q.defer();
					var options = { encoding:'utf8' };
					
					if(encoding) {
						options.encoding = encoding;
					}
					
					if(path) {
						fs.readFile(path, options, function(err,data) {
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
					defer.resolve(null);
					defer = null
				});
				return readDefer.promise;
			},
			/**
			 * Set permisions to the specified file. 
			 * If readOnly parameter is false, the file permisions flags will be set to read/write mode
			 * 
			 * 
			 * @param path - file path
			 * @return {boolean}
			 */
			 setReadOnly: function(path, flag) {
				const deferRO = $q.defer()
				waitForDefered(function() {
					defer = $q.defer();
					if (path) {
						if (flag) {
							fs.chmod(path, 0o444, function(err) {
								resolveBooleanDefer(err, deferRO);
							});
						} else {
							fs.chmod(path, 0o644, function(err) {
								resolveBooleanDefer(err, deferRO);
							});
						}
					} else {
						deferRO.resolve(false);
					}	
					defer.resolve(null);
					defer = null;
				});
				return deferRO.promise;
			},

			/**
			 * Verify readonly status on the specified path. Returns true for readonly otherwise false
			 * 
			 * @param path - directory's full path
			 * @return {boolean}
			 */
			 getReadOnly: function(path) {
				const deferRO = $q.defer()
				waitForDefered(function() {
					try {
						fs.lstat(path, function(err, stats) {
							if (err) throw err;
							if (stats.isSymbolicLink()) {//this method is valid only when calling fs.lstat() (NOT fs.stat())
								deferRO.resolve(isReadOnly(stats.mode));
							} else {
								fs.stat(path, function(err, stats) {
									if (err) throw err;
									deferRO.resolve(isReadOnly(stats.mode));
								});
							}
						});
					} catch (err) {
						deferRO.resolve(false);
						console.error(err);
					}
				})
				return deferRO.promise;
			},
		}
	}
	else {
		return {
			homeDir: function() {console.log("not in electron");},
			tmpDir: function() {console.log("not in electron");},
			listDir: function(path) {console.log("not in electron");},
			watchFile: function(path, callback) {console.log("not in electron");},
			watchDir: function(path, callback) {console.log("not in electron");},
			unwatchFile: function(path) {console.log("not in electron");},
			unwatchDir: function(path) {console.log("not in electron");},
			getFileStats: function(path) {console.log("not in electron");},
			writeFileImpl: function(path, bytes){console.log("not in electron");},
			readFileImpl: function(path, id, bytes){console.log("not in electron");},
			selectDirectory: function(callback){console.log("not in electron");},
			selectDirSync: function(callback){console.log("not in electron");},
			selectFileSync: function(callback){console.log("not in electron");},
			showSaveDialog: function(callback){console.log("not in electron");},
			showSaveDialogSync: function(callback){console.log("not in electron");},
			showOpenDialog: function(callback){console.log("not in electron");},
			showOpenDialogSync: function(options){console.log("not in electron");},
			deleteFile: function(path, errorCallback){console.log("not in electron");},
			openFile: function(path){console.log("not in electron");},
			exists: function(path){console.log("not in electron");},
			appendToTXTFile: function(path, text){console.log("not in electron");},
			copyFile: function(src, dest){console.log("not in electron");},
			createFolder: function(path){console.log("not in electron");},
			deleteFolder: function(path){console.log("not in electron");},
			renameFile: function(oldPath, newPath){console.log("not in electron");},
			writeTXTFileSync: function(path, text_data){console.log("not in electron");},
			readTXTFileSync: function(path){console.log("not in electron");},
			setReadOnly: function(path){console.log("not in electron");},
			getReadOnly: function(path){console.log("not in electron");}
		}
	}
})