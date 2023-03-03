var storage = {
    syncFile: null,
    passThru: null
};

$scope.api.writeFile = function(path,bytes, callback, passThru)
{
    var key=Math.random().toString(10);
	storage[key] = callback;
    storage.passThru = passThru;
	$scope.api.writeFileImpl(path,servoyApi.getMediaUrl(bytes), key);
}

$scope.api.readFileSync = function(path)
{
	var key=Math.random().toString(10);
	storage[key] = $scope.api.syncCallback;
	$scope.api.readFileSyncImpl(path, key); // this will resume after readCallback execution return
    var tmpFile = storage.syncFile;
    storage.syncFile = null;
    return tmpFile;
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	storage[key] = callback;
	$scope.api.readFileImpl(path, key,  null);
}

$scope.api.readCallback = function(data) {
	var path = data.getFieldValue("path");
	var key = data.getFieldValue("id");
	var callback = storage[key];
    if (callback) { 
        callback(path, data);
        storage[key] = null;
    }
}

$scope.api.syncCallback = function(path, data) {
	storage.syncFile = data;
}

$scope.writeCallback = function(message, key) {
	var callback = storage[key];
    if (callback) { 
        callback(message, storage.passThru);
        storage.passThru = null;
        storage[key] = null;
    }
}