angular.module('ngdesktopfile',['servoy'])
.factory("ngdesktopfile",function($services, $q, $window,$utils, $log) 
{
	var fs = null;
	var request = null;
	var session = null;
	var dialog = null;
	var remote = null;
	var watchers = new Map();
	var shell = null;
	
	if (typeof require == "function") {
		fs = require('fs');
		chokidar = require('chokidar');
		request = require('request');
		remote = require('@electron/remote');
		shell = require('electron').shell;
		session = remote.session;
		dialog = remote.dialog;
		
		var j = request.jar();
		request = request.defaults({jar:j});
		// Query all cookies.
		session.defaultSession.cookies.get({url:remote.getCurrentWebContents().getURL()})
		  .then(function(cookies) {
		    cookies.forEach(function(cookie) {
		    	var ck = request.cookie(cookie.name + '=' + cookie.value);
		    	j.setCookie(ck, document.baseURI);
		    });
		  }).catch(function(error){
		    console.log(error)
		  })
	}
	if (fs) {
		function getFullUrl(url) {
			var base = document.baseURI;
			if (!base.endsWith("/")) base = base + "/";
			return base + url;
		}
		var defer = null;
		function waitForDefered(func) {
			if (defer != null) {
				return defer.promise.then(function(){
					return func();
				})
			}
			else func();
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
				const defer = $q.defer();
				waitForDefered(function() {
					fs.readdir(path, function(error, files) {
						 defer.resolve(files);
					})
				})
				return defer.promise;
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
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 */
			writeFile: function(path, bytes) {
				// empty impl, is implemented in server side api calling the impl method below.
			},
			writeFileImpl: function(path, url) {
				waitForDefered(function() {
					function saveUrlToPath(dir, realPath) {
					    fs.mkdir(dir, { recursive: true }, function(err) {
					    	if (err) {
					    		defer.resolve(false);
								defer = null;
								throw err;
					    	}
					    	else {
								const pipe = request(getFullUrl(url)).pipe(fs.createWriteStream(realPath));
								pipe.on("error", function(err) {
									defer.resolve(false);
									defer = null;
									throw err;
								});
								pipe.on("close", function() {
									defer.resolve(true);
									defer = null;
								});
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
			 * Reads the given bytes of a path, the callback is a function that will get as parameters the 'path' as a String and the 'file' as a JSUpload object
			 * If the path is missing or contain only the file name then the native system dialog for opening files it is called.
			 * Please use forward slashes (/) instead of backward slashes in the path/filename
			 * 
			 */
			readFile: function(callback, path) {
				// empty impl, is implemented in server side api calling the impl method below.
			},
			readFileImpl: function(path, id) {
				waitForDefered(function() {
					function readUrlFromPath(path, id) {
						var formData = {
							path: path,
							id: id,
							file: fs.createReadStream(path)
						};
						request.post({url:getFullUrl($utils.generateServiceUploadUrl("ngdesktopfile", "callback")), formData: formData},
							function optionalCallback(err, httpResponse, body) {
								  if (err) {
								    return console.error('upload failed:', err);
								  }
						});
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
				try {
					return dialog.showSaveDialogSync(remote.getCurrentWindow(), options);
				} catch(e) {
					console.log(e);
				}
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
				try {
					return dialog.showOpenDialogSync(remote.getCurrentWindow(), options);
				} catch(e) {
					console.log(e);
				}
			},
			/**
			 * Deletes the given file, optionally calling the error callback when unsuccessful
			 * @param {String} path
			 * @param {Function} [errorCallback]
			 */
			deleteFile: function(path, errorCallback) {
				waitForDefered(function() {
					fs.unlink(path, function(err) {
						if (err && errorCallback) $window.executeInlineScript(errorCallback.formname, errorCallback.script, [err]);
					});
				})
			},
			/**
			 * Return a 'stats' object containing related file's information's.
			 * Please use forward slashes (/) instead of backward slashes in the path
			 * 
			 * @return {stats}
			 */
			getFileStats: function(path) {
				try {
					var fsStats = fs.statSync(path);
					if (fsStats.isSymbolicLink()) {
						fsStats = fs.lStatSync(path);
					}
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
				catch(err) {
					console.log(err);
				}
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
				try {
					var result = false;
					
					if(path) {
						result = fs.existsSync(path);
					}
					
					return result;
				} catch(err) {
					console.log(err);
				}
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
				try {
					encoding = encoding || null;
					
					var result = true;
					
					if(path && text) {
						fs.appendFileSync(path, text, encoding);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
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
				try {
					var mode = (overwriteDest === false) ? 1 : 0; 
					var result = true;
					
					if(src && dest) {
						fs.copyFileSync(src, dest, mode);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
			},
			/**
			 * Synchronously creates a folder, including any necessary but nonexistent parent folders.
			 * 
			 * @param {String} path - folders full path
			 * @return {boolean}
 			 */
			createFolder: function(path) {
				try {
					var result = true;
					
					if(path) {
						fs.mkdirSync(path, { recursive: true });
						result = fs.existsSync(path);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
			},
			/**
			 * Synchronously deletes a folder, fails when folder is not empty
			 * 
			 * @param {String} path - folders full path
			 * @return {boolean}
 			 */
			deleteFolder: function(path) {
				try {
					var result = true;
					
					if(path) {
						fs.rmdirSync(path);
						result = !fs.existsSync(path);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
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
				try {
					var result = true;
					
					if(oldPath && newPath) {
						fs.renameSync(oldPath, newPath);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
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
				try {
					var result = true;
					
					text_data = text_data || '';
					var options = { encoding:'utf8' };
					
					if(encoding) {
						options.encoding = encoding;
					}
					
					if(path) {
						fs.writeFileSync(path, text_data, options);
					} else {
						result = false;
					}
				} catch(err) {
					result = false;
					console.log(err);
				} finally {
					return result;
				}
			},
			/**
			 * Reads and returns the text of the given path/filename
			 * 
			 * @param {String} path
			 * @param {String} [encoding] optional, default 'utf8'
			 * 
			 * @return {boolean}
 			 */
			readTXTFileSync: function(path, encoding) {
				try {
					var result = null;
					
					var options = { encoding:'utf8' };
					
					if(encoding) {
						options.encoding = encoding;
					}
					
					if(path) {
						result = fs.readFileSync(path, options);
					}
				} catch(err) {
					console.log(err);
				} finally {
					return result;
				}
			}
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
			readTXTFileSync: function(path){console.log("not in electron");}
		}
	}
})