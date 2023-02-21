var pathToCallback = {};
var syncFile = null;

$scope.api.writeFile = function(path,bytes, callback)
{
	var key=Math.random().toString(10);
	pathToCallback[key] = callback;
	$scope.api.writeFileImpl(path,servoyApi.getMediaUrl(bytes), callback);
}

$scope.api.readFileSync = function(path)
{
	var key=Math.random().toString(10);
	pathToCallback[key] = $scope.api.syncCallback;
    syncFile = null;
	$scope.api.readFileSyncImpl(path, key); // this is a sync function
    return syncFile;
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	pathToCallback[key] = callback;
	$scope.api.readFileImpl(path, key,  null);
}

$scope.api.callback = function(file) {
	var path = file.getFieldValue("path");
	var key = file.getFieldValue("id");
	var callback = pathToCallback[key];
    if (callback) { 
        callback(path, file);
        pathToCallback[key] = null;
    }
}

$scope.api.syncCallback = function(path, file) {
    syncFile = file;
}