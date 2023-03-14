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

$scope.api.writeTempFileSync = function(bytes) 
{
    var key=Math.random().toString(10);
    storage[key] = {
        callback: $scope.api.syncCallback, //this will be my callback which is setting my temporary path to storage object
        isSync: true //this will tell to the writeCallback below where this call was originated
    }
    $scope.api.writeFileSyncImpl(servoyApi.getMediaUrl(bytes), key); // execution flow will stop here and resume after writeCallback execution return
    var tmpData = storage[key].syncData; // this syncData is your temporary path created in the client side
    storage[key] = null; //reset the storage
    return tmpData; //return temporary path
}

$scope.api.readFileSync = function(path)
{
	var key=Math.random().toString(10);
	storage[key] = {
        callback: $scope.api.syncCallback, 
        isSync: true    
    };
	$scope.api.readFileSyncImpl(path, key); // this will resume after readCallback execution return
    var tmpData = storage[key].syncData;
    storage[key] = null;
    return tmpData;     //return my temporary path
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

$scope.api.syncCallback = function(key, data) { //this is used for both readFileSync and writeTempFileSync
	storage[key].syncData = data;
}

$scope.writeCallback = function(message, key) {
	var record = storage[key];
    if (storage[key].callback && storage[key].isSync) { //if this call is originated from writeTempFileSync
        storage[key].callback(key, data); //this callback is set to $scope.api.syncCallback
    } else if (record.callback) { //else we keep the original processing
        record.callback(message, record.passThru);
        storage[key] = null;
    }
}

$scope.api.cleanTempFiles()
{
	return $scope.api.cleanTempFiles();
}