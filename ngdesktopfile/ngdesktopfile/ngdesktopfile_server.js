var storage = {};

$scope.api.writeFile = function(path,bytes, callback, passThru)
{
    var key=Math.random().toString(10);
	storage[key] = {
        callback: callback,
        passThru: passThru
    }
	$scope.api.writeFileImpl(path,servoyApi.getMediaUrl(bytes), key);
}

$scope.api.readFileSync = function(path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: $scope.api.syncCallback,
        isSync: true
    };
	$scope.api.readFileSyncImpl(path, key); // this will resume after readCallback execution return
    var tmpFile = storage[key].syncFile;
    storage[key] = null;
    return tmpFile;
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: callback
    };
	$scope.api.readFileImpl(path, key,  null);
}

$scope.api.readCallback = function(data) {
	var key = data.getFieldValue("id");
    if (storage[key].callback && storage[key].isSync) { 
        storage[key].callback(key, data);
    } else if (storage[key].callback) {
        storage[key].callback(data.getFieldValue("path"), data);
        storage[key] = null;
    }
}

$scope.api.syncCallback = function(key, data) {
	storage[key].syncFile = data;
}

$scope.writeCallback = function(message, key) {
	var record = storage[key];
    if (record.callback) { 
        record.callback(message, record.passThru);
        storage[key] = null;
    }
}