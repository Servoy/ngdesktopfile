var pathToCallback = {};

$scope.api.writeFile = function(path,bytes, callback)
{
	var key=Math.random().toString(10);
	pathToCallback[key] = callback;
	$scope.api.writeFileImpl(path,servoyApi.getMediaUrl(bytes), callback);
}

$scope.api.readFile = function(callback, path)
{
	var key=Math.random().toString(10);
	pathToCallback[key] = callback;
	$scope.api.readFileImpl(path, key);
}

$scope.api.callback = function(file) {
	var path = file.getFieldValue("path");
	var key = file.getFieldValue("id");
	var callback = pathToCallback[key];
	if (callback) callback(path, file);
	pathToCallback[key] = null;
}