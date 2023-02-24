{
	"name": "ngdesktopfile",
	"displayName": "NGDesktop File",
	"version": 1,
 	"definition": "ngdesktopfile/ngdesktopfile/ngdesktopfile.js",
	"serverscript":"ngdesktopfile/ngdesktopfile/ngdesktopfile_server.js",
	"ng2Config": {
	   "packageName": "@servoy/ngdesktopfile",
	   "serviceName": "NGDesktopFileService",
	   "entryPoint": "dist/servoy/ngdesktopfile"
	},
 	"api":
 	{
	   	"homeDir": {
			"returns":"string"
		},
		"tmpDir": {
			"returns":"string"
		},
		"listDir": {
			"parameters" : [
				{"name":"path", "type":"string"}
			],
			"returns":"string[]"
		},
		"watchDir": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"callback", "type":"function"}
			],
			"async-now":true
		},
		"unwatchDir": {
			"parameters" : [
				{"name":"path", "type":"string"}
			],
			"async-now":true
		},
		"watchFile": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"callback", "type":"function"}
			],
			"async-now":true
		},
		"unwatchFile": {
			"parameters" : [
				{"name":"path", "type":"string"}
			],
			"async-now":true
		},
		"writeFile": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"bytes", "type":"byte[]"},
				{"name":"callback", "type":"function", "optional": true}
			],
			"async-now":true
		},
		"readFile": {
			"parameters" : [
				{"name":"callback", "type":"function"},
				{"name":"path", "type":"string", "optional": true}
			],
			"async-now":true
		},
		"readFileSync": {
			"parameters" : [
				{"name":"path", "type":"string", "optional": true}
			],
			"returns":"object"
		},
		"setReadOnly": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"flag", "type":"boolean"}
			],
			"returns": "object"
		},
		"getReadOnly": {
			"parameters" : [
				{"name":"path", "type":"string"}
			],
			"returns": "boolean"
		},
		"deleteFileSync": {
		 	"parameters": [
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "boolean"
		},
		"deleteFile": {
		 	"parameters": [
		 		{"name":"path", "type":"string"},
		 		{"name":"errorCallback", "type":"function", "optional": true}
		 	],
		 	"async-now":true
		},
		 "getFileStats": {
		 	"parameters": [
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "stats"
		 },
		 "selectDirectory": {
			"parameters" : [
				{"name":"callback", "type":"function"}
			],
			"async-now":true
		 },
		 "showSaveDialog": {
			"parameters" : [
				{"name":"callback", "type":"function"},
				{"name":"options", "type":"object", "optional": true}
			],
			"async-now":true
		 },
		 "selectDirectorySync": {
			"parameters" : [
				{"name":"path", "type":"string", "optional": true}
			],
		 	"returns": "string"
		 },
		  "selectFileSync": {
			"parameters" : [
				{"name":"path", "type":"string", "optional": true}
			],
		 	"returns": "string"
		 },
		 "showSaveDialogSync": {
			"parameters" : [
				{"name":"options", "type":"object", "optional": true}
			],
		 	"returns": "string"
		 },
		 "showOpenDialog": {
			"parameters" : [
				{"name":"callback", "type":"function"},
				{"name":"options", "type":"object", "optional": true}
			],
			"async-now":true
		 },
		 "showOpenDialogSync": {
			"parameters" : [
				{"name":"options", "type":"object", "optional": true}
			], 
			"returns": "string[]"
		 }, 
		 "openFile": {
		 	"parameters":[
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "string"
		 },
		 "exists": {
		 	"parameters":[
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "boolean"
		 },
		 "appendToTXTFile": {
		 	"parameters":[
		 		{"name":"path", "type":"string"},
		 		{"name":"text", "type":"string"},
		 		{"name":"encoding", "type":"string", "optional": true}
		 	],
		 	"returns": "boolean"
		 },
		 "copyFile": {
		 	"parameters":[
		 		{"name":"src", "type":"string"},
		 		{"name":"dest", "type":"string"},
		 		{"name":"overwriteDest", "type":"boolean", "optional": true}
		 	],
		 	"returns": "boolean"
		 },
		 "createFolder": {
		 	"parameters":[
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "boolean"
		 },
		 "deleteFolder": {
		 	"parameters":[
		 		{"name":"path", "type":"string"}
		 	],
		 	"returns": "boolean"
		 },
		 "renameFile": {
		 	"parameters":[
		 		{"name":"oldPath", "type":"string"},
		 		{"name":"newPath", "type":"string"}
		 	],
		 	"returns": "boolean"
		 },
		 "writeTXTFileSync": {
		 	"parameters":[
		 		{"name":"path", "type":"string"},
		 		{"name":"text_data", "type":"string"},
		 		{"name":"encoding", "type":"string", "optional": true}
		 	],
		 	"returns": "boolean"
		 },
		 "readTXTFileSync": {
		 	"parameters":[
		 		{"name":"path", "type":"string"},
		 		{"name":"encoding", "type":"string", "optional": true}
		 	],
		 	"returns": "string"
		 }
	},
 	"internalApi": {
 		"writeFileImpl": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"url", "type":"string"},
				{"name":"callback", "type":"function", "optional": true}
			],
			"async-now":true
		},
		"readFileImpl": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"key", "type":"string"},
                {"name":"defer", "type":"object", "optional": true}
			],
			"async-now":true
		},
        "readFileSyncImpl": {
			"parameters" : [
				{"name":"path", "type":"string"},
				{"name":"key", "type":"string"}
			],
			"returns":"object"
		},
		"callback": {
			"parameters" : [
				{"name":"file", "type":"object"}
			]
		}
 	},
 	"types": {
		"stats": {
			"isBlockDevice": {"type": "boolean", "default": false},
			"isCharacterDevice": {"type": "boolean", "default": false},
			"isDirectory": { "type": "boolean", "default": false},
			"isFIFO": { "type": "boolean", "default": false},
			"isFile": { "type": "boolean", "default": false},
			"isSocket": { "type": "boolean", "default": false},
			"isSymbolicLink": { "type": "boolean", "default": false},
			"dev": { "type": "long"},
			"ino": { "type": "long"},
			"mode": { "type": "long"},
			"nlink": { "type": "long"}, 
			"uid": { "type": "long"},
			"gid": { "type": "long"},
			"rdev": { "type": "long"},
			"size": { "type": "long"},
			"blksize": { "type": "long"},
			"blocks": { "type": "long"},
			"atimeMs": { "type": "long"},
			"mtimeMs": { "type": "long"},
			"ctimeMs": { "type": "long"},
			"birthtimeMs": { "type": "long"}
		}
	}
}