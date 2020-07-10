/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2014 Adobe
* All Rights Reserved.
*
* NOTICE: Adobe permits you to use, modify, and distribute this file in
* accordance with the terms of the Adobe license agreement accompanying
* it. If you have received this file from a source other than Adobe,
* then your use, modification, or distribution of it requires the prior
* written permission of Adobe.
**************************************************************************/
#include "PPro_API_Constants.jsx"
#include "json.jsx"; //Script from GitHub: https://github.com/indiscripts/extendscript/tree/master/JSON


var globalSelection = [];

$._PPP_={

	createDeepFolderStructure : function(foldersArray, maxDepth) {
		if (typeof foldersArray !== 'object' || foldersArray.length <= 0) {
			throw new Error('No valid folders array was provided!');
		}

		// if the first folder already exists, throw error
		for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
			var curChild = app.project.rootItem.children[i];
			if (curChild.type === ProjectItemType.BIN && curChild.name === foldersArray[0]) {
				throw new Error('Folder with name "' + curChild.name + '" already exists!');
			}
		}

		// create the deep folder structure
		var currentBin = app.project.rootItem.createBin(foldersArray[0]);
		for (var m = 1; m < foldersArray.length && m < maxDepth; i++) {
			currentBin = currentBin.createBin(foldersArray[i]);
		}
	},

	getVersionInfo : function() {
		return 'PPro ' + app.version + 'x' + app.build;
	},

	getUserName : function() {
		var	homeDir		= new File('~/');
		var	userName	= homeDir.displayName;
		homeDir.close();
		return userName;
	},

	keepPanelLoaded : function() {
		app.setExtensionPersistent("com.adobe.PProPanel", 0); // 0, while testing (to enable rapid reload); 1 for "Never unload me, even when not visible."
	},

	updateGrowingFile : function() {
		var numItems	= app.project.rootItem.children.numItems;
		for (var i = 0; i < numItems; i++){
			var currentItem = app.project.rootItem.children[i];
			if (currentItem){
				currentItem.refreshMedia();
			}
		}
	},

	getSep : function() {
		if (Folder.fs == 'Macintosh') {
			return '/';
		} else {
			return '\\';
		}
	},

	saveProject : function() {
		app.project.save();
	},

	exportCurrentFrameAsPNG : function() {
		app.enableQE();
		var activeSequence	= qe.project.getActiveSequence(); 	// note: make sure a sequence is active in PPro UI
		if (activeSequence) {
			// Create a file name based on timecode of frame.
			var time			= activeSequence.CTI.timecode; 	// CTI = Current Time Indicator.
			var removeThese 	= /:|;/ig;    // Why? Because Windows chokes on colons.
			var safeTimeStr         = time.replace(removeThese, '_');
			var outputPath		= new File("~/Desktop");
			var outputFileName	= outputPath.fsName + $._PPP_.getSep() + safeTimeStr + '___' + activeSequence.name;
			activeSequence.exportFramePNG(time, outputFileName);
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	renameFootage : function() {
		var item = app.project.rootItem.children[0]; // assumes the zero-th item in the project is footage.
		if (item) {
			item.name = item.name + ", updated by PProPanel.";
		} else {
			$._PPP_.updateEventPanel("No project items found.");
		}
	},

	getActiveSequenceName : function() {
		if (app.project.activeSequence) {
			return app.project.activeSequence.name;
		} else {
			return "No active sequence.";
		}
	},

	projectPanelSelectionChanged : function(projectItems, viewID) {

		var remainingArgs 	= projectItems.length;
		var message			= "";

		if (remainingArgs){
			var message 		= remainingArgs + " items selected: ";
			var view 			= viewID;

			// Concatenate selected project item names, into message.
			globalSelection = [];
			for (var i = 0; i < projectItems.length; i++) {
				message += projectItems[i].name;
				globalSelection[i] = projectItems[i];
				remainingArgs--;
				if (remainingArgs > 1) {
					message += ', ';
				}
				if (remainingArgs === 1){
					message += ", and ";
				}
				if (remainingArgs === 0) {
					message += ".";
				}
			}
		} else {
			globalSelection = [];
			message = '0 items selected.';
		}
		//app.setSDKEventMessage(message, 'info');
	},

	registerProjectPanelSelectionChangedFxn : function() {
		var success = app.bind("onSourceClipSelectedInProjectPanel", $._PPP_.projectPanelSelectionChanged);
	},

	saveCurrentProjectLayout : function() {
		var currentProjPanelDisplay = app.project.getProjectPanelMetadata();
		if (currentProjPanelDisplay){
			var outFileName			= 'Previous_Project_Panel_Display_Settings.xml';
			var actualProjectPath	= new File(app.project.path);
			var projDir 			= actualProjectPath.parent;
			if (actualProjectPath){
				var completeOutputPath	= projDir +  $._PPP_.getSep() + outFileName;
				var outFile				= new File(completeOutputPath);
				if (outFile){
					outFile.encoding = "UTF8";
					outFile.open("w", "TEXT", "????");
					outFile.write(currentProjPanelDisplay);
					$._PPP_.updateEventPanel("Saved layout to next to the project.");
					outFile.close();
				}
				actualProjectPath.close();
			}
		} else {
			$._PPP_.updateEventPanel("Could not retrieve current project layout.");
		}
	},

	setProjectPanelMeta : function() {
		var filterString = "";
		if (Folder.fs === 'Windows'){
			filterString = "XML files:*.xml";
		}
		var fileToOpen = File.openDialog (	"Choose Project panel layout to open.",
											filterString,
											false);
		if (fileToOpen) {
			if (fileToOpen.fsName.indexOf('.xml')){ // We should really be more careful, but hey, it says it's XML!
				fileToOpen.encoding = "UTF8";
				fileToOpen.open("r", "TEXT", "????");
				var fileContents = fileToOpen.read();
				if (fileContents){
					var setResult = app.project.setProjectPanelMetadata(fileContents);
					if (setResult){
						$._PPP_.updateEventPanel("Could not update layout using " + fileToOpen.filename + ".");
					} else {
						$._PPP_.updateEventPanel("Updated layout from .xml file.");
					}
				}
			}
		} else {
			$._PPP_.updateEventPanel("No valid layout file chosen.");
		}
	},

	exportSequenceAsPrProj : function() {
		var activeSequence = app.project.activeSequence;
		if (activeSequence) {
			var startTimeOffset		= activeSequence.zeroPoint;
			var prProjExtension		= '.prproj';
			var outputName			= activeSequence.name;
			var outFolder			= Folder.selectDialog();

			if (outFolder) {
				var completeOutputPath =	outFolder.fsName +
											$._PPP_.getSep() +
											outputName +
											prProjExtension;

				app.project.activeSequence.exportAsProject(completeOutputPath);

				$._PPP_.updateEventPanel("Exported " + app.project.activeSequence.name + " to " +completeOutputPath + ".");
			} else {
				$._PPP_.updateEventPanel("Could not find or create output folder.");
			}

			// Here's how to import N sequences from a project.
			//
			// var seqIDsToBeImported = new Array;
			// seqIDsToBeImported[0] = ID1;
			// ...
			// seqIDsToBeImported[N] = IDN;
			//
			//app.project.importSequences(pathToPrProj, seqIDsToBeImported);

		}else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	createSequenceMarkers : function() {
		var activeSequence = app.project.activeSequence;
		if (activeSequence) {
			var markers		= activeSequence.markers;
			if (markers) {
				var numMarkers	= markers.numMarkers;
				if (numMarkers > 0) {
					var marker_index = 1;
					for(var current_marker	=	markers.getFirstMarker();
							current_marker	!==	undefined;
							current_marker	=	markers.getNextMarker(current_marker)){
						if (current_marker.name !== "") {
							$._PPP_.updateEventPanel(	'Marker ' + marker_index + ' name = ' + current_marker.name + '.');
						} else {
							$._PPP_.updateEventPanel(	'Marker ' + marker_index + ' has no name.');
						}

						if (current_marker.end.seconds > 0) {
							$._PPP_.updateEventPanel(	'Marker ' + marker_index + ' duration = ' + (current_marker.end.seconds - current_marker.start.seconds) + ' seconds.');
						} else {
							$._PPP_.updateEventPanel(	'Marker ' + marker_index + ' has no duration.');
						}
						$._PPP_.updateEventPanel('Marker ' + marker_index + ' starts at ' + current_marker.start.seconds + ' seconds.');
						marker_index = marker_index + 1;
					}
				}
			}

			var newCommentMarker			= markers.createMarker(12.345);
			newCommentMarker.name			= 'Marker created by PProPanel.';
			newCommentMarker.comments		= 'Here are some comments, inserted by PProPanel.';
			newCommentMarker.end			= 15.6789;

			var newWebMarker				= markers.createMarker(14.345);
			newWebMarker.name				= 'Web marker created by PProPanel.';
			newWebMarker.comments			= 'Here are some comments, inserted by PProPanel.';
			newWebMarker.end				= 17.6789;
			newWebMarker.setTypeAsWebLink("http://www.adobe.com", "frame target");
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	exportFCPXML : function() {
		if (app.project.activeSequence) {
			var projPath			= new File(app.project.path);
			var parentDir			= projPath.parent;
			var outputName			= app.project.activeSequence.name;
			var xmlExtension		= '.xml';
			var outputPath			= Folder.selectDialog("Choose the output directory");

			if (outputPath) {
				var completeOutputPath = outputPath.fsName + $._PPP_.getSep() + outputName + xmlExtension;
				app.project.activeSequence.exportAsFinalCutProXML(completeOutputPath, 1); // 1 == suppress UI
				var info = 	"Exported FCP XML for " +
							app.project.activeSequence.name +
							" to " +
							completeOutputPath +
							".";
				$._PPP_.updateEventPanel(info);
			} else {
				$._PPP_.updateEventPanel("No output path chosen.");
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	openInSource : function() {
		var filterString = "";
		if (Folder.fs === 'Windows'){
			filterString = "All files:*.*";
		}
		var fileToOpen = File.openDialog (	"Choose file to open.",
											filterString,
											false);
		if (fileToOpen) {
			app.sourceMonitor.openFilePath(fileToOpen.fsName);
			app.sourceMonitor.play(1.73); // playback speed as float, 1.0 = normal speed forward
			var position = app.sourceMonitor.getPosition(); // new in 13.0
			$._PPP_.updateEventPanel("Current Source monitor position: " + position.seconds + " seconds.");
			fileToOpen.close();
		} else {
			$._PPP_.updateEventPanel("No file chosen.");
		}
	},

	searchForBinWithName : function (nameToFind) {
		// deep-search a folder by name in project
		var deepSearchBin = function(inFolder) {
		  if (inFolder && inFolder.name === nameToFind && inFolder.type === 2) {
			return inFolder;
		  } else {
			for (var i = 0; i < inFolder.children.numItems; i++) {
			  if (inFolder.children[i] && inFolder.children[i].type === 2) {
				var foundBin = deepSearchBin(inFolder.children[i]);
				if (foundBin) return foundBin;
			  }
			}
		  }
		  return undefined;
		};
		return deepSearchBin(app.project.rootItem);
	},

	importFiles : function() {
		var filterString = "";
		if (Folder.fs === 'Windows'){
			filterString = "All files:*.*";
		}
		if (app.project) {
			var fileOrFilesToImport	= File.openDialog (	"Choose files to import", 	// title
														filterString,				// filter available files?
														true); 						// allow multiple?
			if (fileOrFilesToImport) {
				// We have an array of File objects; importFiles() takes an array of paths.
				var importThese = [];
				if (importThese){
					for (var i = 0; i < fileOrFilesToImport.length; i++) {
						importThese[i] = fileOrFilesToImport[i].fsName;
					}
					app.project.importFiles(importThese,
											1,				// suppress warnings
											app.project.getInsertionBin(),
											0);				// import as numbered stills
				}
			} else {
				$._PPP_.updateEventPanel("No files to import.");
			}
		}
	},

	muteFun : function() {
		if (app.project.activeSequence){
			for (var i = 0; i < app.project.activeSequence.audioTracks.numTracks; i++){
				var currentTrack	= app.project.activeSequence.audioTracks[i];
				if (Math.random() > 0.5){
					currentTrack.setMute(!(currentTrack.isMuted()));
				 }
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	disableImportWorkspaceWithProjects : function() {
		var prefToModify	= 'FE.Prefs.ImportWorkspace';
		var appProperties 	= app.properties;

		if (appProperties){
			var propertyExists 		= app.properties.doesPropertyExist(prefToModify);
			var propertyIsReadOnly 	= app.properties.isPropertyReadOnly(prefToModify);
			var propertyValue 		= app.properties.getProperty(prefToModify);

			appProperties.setProperty(prefToModify, false, 1); // optional 3rd param : 0 = non-persistent,  1 = persistent (default)
			var safetyCheck = app.properties.getProperty(prefToModify);
			if (safetyCheck != propertyValue){
				$._PPP_.updateEventPanel("Changed \'Import Workspaces with Projects\' from " + propertyValue + " to " + safetyCheck + ".");
			}
		} else {
			$._PPP_.updateEventPanel("Properties not found.");
		}
	},

	turnOffStartDialog : function (){
		var prefToModify	= 'MZ.Prefs.ShowQuickstartDialog';
		var appProperties 	= app.properties;
		if (appProperties){
			var propertyExists 		= app.properties.doesPropertyExist(prefToModify);
			var propertyIsReadOnly 	= app.properties.isPropertyReadOnly(prefToModify);
			var originalValue 		 = app.properties.getProperty(prefToModify);

			appProperties.setProperty(prefToModify, false, 1, 1); // optional 4th param : 0 = non-persistent,  1 = persistent (default)
			var safetyCheck = app.properties.getProperty(prefToModify);
			if (safetyCheck != originalValue){
				$._PPP_.updateEventPanel("Start dialog now OFF. Enjoy!");
			} else {
				$._PPP_.updateEventPanel("Start dialog was already OFF.");
			}
		} else {
			$._PPP_.updateEventPanel("Properties not found.");
		}
	},

	replaceMedia : function() {

		// 	Note: 	This method of changing paths for projectItems is from the time
		//			before PPro supported full-res AND proxy paths for each projectItem.
		//			This can still be used, and will change the hi-res projectItem path, but
		//			if your panel supports proxy workflows, it should rely instead upon
		//			projectItem.setProxyPath() instead.

		var firstProjectItem = app.project.rootItem.children[0];
		if (firstProjectItem) {
			if (firstProjectItem.canChangeMediaPath()) {

				// 	NEW in 9.0: setScaleToFrameSize() ensures that for all clips created from this footage,
				//	auto scale to frame size will be ON, regardless of the current user preference.
				//	This is	important for proxy workflows, to avoid mis-scaling upon replacement.

				//	Addendum: This setting will be in effect the NEXT time the projectItem is added to a
				//	sequence; it will not affect or reinterpret clips from this projectItem, already in
				//	sequences.

				firstProjectItem.setScaleToFrameSize();
				var filterString = "";
				if (Folder.fs === 'Windows'){
					filterString = "All files:*.*";
				}
				var replacementMedia = File.openDialog(	"Choose new media file, for " +
														firstProjectItem.name,
														filterString,			// file filter
														false); 				// allow multiple?

				if (replacementMedia) {
					var suppressWarnings	= true;
					firstProjectItem.name	= replacementMedia.name + ", formerly known as " + firstProjectItem.name;
					firstProjectItem.changeMediaPath(replacementMedia.fsName, suppressWarnings);  // new in 12.1
					replacementMedia.close();
				}
			} else {
				$._PPP_.updateEventPanel("Couldn't change path of " + firstProjectItem.name + ".");
			}
		} else {
			$._PPP_.updateEventPanel("No project items found.");
		}
	},

	openProject : function() {
		var filterString = "";
		if (Folder.fs === 'Windows'){
			filterString = "Premiere Pro project files:*.prproj";
		}
		var projToOpen	= File.openDialog (	"Choose project:",
											filterString,
											false);
		if ((projToOpen) && projToOpen.exists) {
			app.openDocument(	projToOpen.fsName,
								1,					// suppress 'Convert Project' dialogs?
								1,					// suppress 'Locate Files' dialogs?
								1);					// suppress warning dialogs?
			projToOpen.close();
		}
	},

	exportFramesForMarkers : function (){
		app.enableQE();
		var activeSequence = app.project.activeSequence;
		if (activeSequence) {
			var markers			= activeSequence.markers;
			var markerCount		= markers.numMarkers;
			if (markerCount){
				var firstMarker = markers.getFirstMarker();
				activeSequence.setPlayerPosition(firstMarker.start.ticks);
				$._PPP_.exportCurrentFrameAsPNG();

				var previousMarker = 0;
				if (firstMarker){
					for(var i = 0; i < markerCount; i++){
						if (i === 0){
							currentMarker = markers.getNextMarker(firstMarker);
						} else {
							currentMarker = markers.getNextMarker(previousMarker);
						}
						if (currentMarker){
							activeSequence.setPlayerPosition(currentMarker.start.ticks);
							previousMarker = currentMarker;
							$._PPP_.exportCurrentFrameAsPNG();
						}
					}
				}
			} else {
				$._PPP_.updateEventPanel("No markers applied to " + activeSequence.name + ".");
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	createSequence : function(name) {
		var someID	= "xyz123";
		var seqName = prompt('Name of sequence?',	 '<<<default>>>', 'Sequence Naming Prompt');
		app.project.createNewSequence(seqName, someID);
	},

	createSequenceFromPreset : function(presetPath) {
		app.enableQE();
		var seqName = prompt('Name of sequence?',	 '<<<default>>>', 'Sequence Naming Prompt');
		if (seqName) {
			qe.project.newSequence(seqName, presetPath);
		}
	},

	transcode : function(outputPresetPath) {
        app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
		app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
		app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
		app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
		app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);

		var projRoot = app.project.rootItem.children;

		if (projRoot.numItems){
			var firstProjectItem = app.project.rootItem.children[0];
			if (firstProjectItem){

				app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

				var fileOutputPath	= Folder.selectDialog("Choose the output directory");
				if (fileOutputPath){
					var outputName	= firstProjectItem.name.search('[.]');
					if (outputName == -1){
						outputName	= firstProjectItem.name.length;
					}
					outFileName	= firstProjectItem.name.substr(0, outputName);
					outFileName	= outFileName.replace('/', '-');
					var completeOutputPath	= fileOutputPath.fsName + $._PPP_.getSep() + outFileName + '.mxf';
					var removeFromQueue		= true;
					var rangeToEncode		= app.encoder.ENCODE_IN_TO_OUT;
					app.encoder.encodeProjectItem(	firstProjectItem,
													completeOutputPath,
													outputPresetPath,
													rangeToEncode,
													removeFromQueue);
					app.encoder.startBatch();
				}
			} else {
				$._PPP_.updateEventPanel("No project items found.");
			}
		} else {
			$._PPP_.updateEventPanel("Project is empty.");
		}
	},

	transcodeExternal : function (outputPresetPath){
		app.encoder.launchEncoder();
		var filterString = "";
		if (Folder.fs === 'Windows'){
			filterString = "All files:*.*";
		}
		var fileToTranscode = File.openDialog (	"Choose file to open.",
												filterString,
												false);
		if (fileToTranscode) {
			var fileOutputPath = Folder.selectDialog("Choose the output directory");
			if (fileOutputPath){

				var srcInPoint		= 1.0; 	// encode start time at 1s (optional--if omitted, encode entire file)
				var srcOutPoint		= 3.0; // encode stop time at 3s (optional--if omitted, encode entire file)
				var removeFromQueue	= false;

				var result = app.encoder.encodeFile(fileToTranscode.fsName,
													fileOutputPath.fsName,
													outputPresetPath,
													removeFromQueue,
													srcInPoint,
													srcOutPoint);
			}
		}
	},

	mappen: function(outputPresetPath) {
		var projFile = new File(app.project.path);
		var projPath	= app.project.path;
		var projName = app.project.name;
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		var a1 = new Folder(projFolder + 'AE/16x9');
		if (!a1.exists)
	  	a1.create();

		var a2 = new Folder(projFolder + 'AE/9x16');
		if (!a2.exists)
	  	a2.create();

		var a3 = new Folder(projFolder + 'AE/1x1');
		if (!a3.exists)
	  	a3.create();

		var b = new Folder(projFolder + 'Audio/');
		if (!b.exists)
			b.create();

		var c = new Folder(projFolder + 'Artwork/');
		if (!c.exists)
			c.create();

		var d = new Folder(projFolder + 'Video/');
		if (!d.exists)
			d.create();

		var e = new Folder(projFolder + 'Briefing/');
		if (!e.exists)
			e.create();

		var f = new Folder(projFolder + 'Export/');
		if (!f.exists)
	  	f.create();

		if (!$._PPP_.searchForBinWithName('_Spots')) {
			binSpots = app.project.rootItem.createBin("_Spots");
			binSpots.createBin("_NVT");
			binOnline = binSpots.createBin("Online");
			binOnline.createBin("16x9");
			binOnline.createBin("1x1");
			binOnline.createBin("9x16");
			binOnline.createBin("YouTube");
			binSpots.createBin("TV");
		}
		if (!$._PPP_.searchForBinWithName('AE')) {
			binAE = app.project.rootItem.createBin("AE");
			binAE.createBin("16x9");
			binAE.createBin("1x1");
			binAE.createBin("9x16");
			binAE.createBin("Dyn Subs");
		}
		if (!$._PPP_.searchForBinWithName('Audio')) {
			app.project.rootItem.createBin("Audio");
		}
		if (!$._PPP_.searchForBinWithName('Video')) {
			app.project.rootItem.createBin("Video");
		}
	},

	importspots: function(outputPresetPath) { //Todo: Add check to see if JSON file exists
		app.enableQE();
		//Get project number from project filename
		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) { //Check if project name starts with the project number
			//Import JSON file data
			var scriptFile = File("Volumes/Mediapool/_JSON/" + projNr + ".json"); //Only for mac os, change for windows when needed
			//var fileExists =
			scriptFile.open('r');
			var content = scriptFile.read(); //Read JSON data into a string
			scriptFile.close();
			contentObj = JSON.eval(content); //convert JSON data string into an object
			//Cycle through spot titles, check if their sequence exists and create if not
			var spotCount = parseInt(contentObj.project.spotCount); //Get number of spots from JSON data
			for (i=1;i<(spotCount+1);i++){
				var spotNr = "00" + i.toString();
				spotNr = spotNr.slice(spotNr.length-3,spotNr.length);
				spotNr = "spot" + spotNr;
				var spotName = contentObj.project.spots[spotNr].spotTitel;
				var spotLength = contentObj.project.spots[spotNr].spotLengte + "s";
				var spotRelease = contentObj.project.spots[spotNr].spotRelease.toUpperCase();
				var newSequenceName = spotName + " " + spotLength + " " + spotRelease;
				//Get number of sequences currently in premiere
				var seqsNum = 0;
				for (j=0;j<200;j++) {
					if (app.project.sequences[j]) {
						seqsNum += 1;
					} else {
						break;
					}
				}
				//Check if sequence exists
				spotExists = 0;
				for (k=0;k<seqsNum;k++) {
					if (app.project.sequences[k].name == newSequenceName) {
						spotExists = 1;
					}
				}
				//Create sequence if it doesn't exist
				if (spotExists == 0) {
					qe.project.newSequence(newSequenceName, outputPresetPath + "Bake standaard sequence.sqpreset"); //Create the sequence using a sequence preset (located in CEP panel > payloads folder)
				}
			}
		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	renderprotools: function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStamp = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + t.toString();

		var seqName = "";
		var seqLength = "";

		for (var i = 0; i < globalSelection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == globalSelection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j];
						seqName = globalSelection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

			var checkLength = false;
			seqLength = app.project.activeSequence.end/254016000000;
			seqNameLength = seqName.match(/\d+(?=s)/);
			//alert(seqLength + " " + seqNameLength); //Length in seconds
			if (seqLength > seqNameLength) {
				seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
				if (seqLengthConfirm){
					checkLength = true;
				}
			} else if (seqLength < seqNameLength) {
				seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
				if (seqLengthConfirm){
					checkLength = true;
				}
			} else {
					checkLength = true;
			}

			if (checkLength == true){

			if (activeSequence && globalSelection.length > 0)	{
				app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

				var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
				var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
				var timeTicks	= activeSequence.CTI.ticks;
				var timeString	= activeSequence.CTI.timecode;

				var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
				var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

				var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
				var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

				var projFile = new File(app.project.path);
				var projPath	= app.project.path;
				var projName = app.project.name;
				var projFolder = projPath.slice(0,(projPath.length-projName.length));

				var f = new Folder(projFolder + 'Export/Protools/' + timeStamp);
	    	if (!f.exists)
	      	f.create();
				var outputPath  = f;

				if ((outputPath) && projFile.exists){

					var presetName = "Prores ProTools";

					var outPreset		= new File(outputPresetPath + presetName + ".epr");
					if (outPreset.exists === true){
						var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
						if (outputFormatExtension){
							var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

							var fullPathToFile	= 	outputPath.fsName 	+
													$._PPP_.getSep() 	+
													activeSequence.name +
													"." +
													outputFormatExtension;

							var outFileTest = new File(fullPathToFile);

							if (outFileTest.exists){
								var destroyExisting	= confirm("A Protools file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
								if (destroyExisting){
									outFileTest.remove();
									outFileTest.close();
								}
							}

							//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
							app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
							//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
							app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
							app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


							// use these 0 or 1 settings to disable some/all metadata creation.

							app.encoder.setSidecarXMPEnabled(0);
							app.encoder.setEmbeddedXMPEnabled(0);

							/*

							For reference, here's how to export from within PPro (blocking further user interaction).

							var seq = app.project.activeSequence;

							if (seq) {
								seq.exportAsMediaDirect(fullPathToFile,
														outPreset.fsName,
														app.encoder.ENCODE_WORKAREA);

								Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
								var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
							}

							*/

							var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																	fullPathToFile,
																	outPreset.fsName,
																	app.encoder.ENCODE_WORKAREA,
																	1);	   // Remove from queue upon successful completion?
							$._PPP_.updateEventPanel('jobID = ' + jobID);
							outPreset.close();

							app.project.exportOMF(app.project.activeSequence, outputPath.fsName + "/" + activeSequence.name + ".omf", activeSequence.name, 48000, 24, 1, 0, 0, 1000, 1);
						}

					} else {
						$._PPP_.updateEventPanel("Could not find output preset.");
					}
				} else {
					$._PPP_.updateEventPanel("Could not find/create output path.");
				}
				projFile.close();
			} else {
				//$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	}
	},

	renderprotoolsvideo: function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStamp = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + t.toString();

		var seqName = "";
		var seqLength = "";

		for (var i = 0; i < globalSelection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == globalSelection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j];
						seqName = globalSelection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

			var checkLength = false;
			seqLength = app.project.activeSequence.end/254016000000;
			seqNameLength = seqName.match(/\d+(?=s)/);
			//alert(seqLength + " " + seqNameLength); //Length in seconds
			if (seqLength > seqNameLength) {
				seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
				if (seqLengthConfirm){
					checkLength = true;
				}
			} else if (seqLength < seqNameLength) {
				seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
				if (seqLengthConfirm){
					checkLength = true;
				}
			} else {
					checkLength = true;
			}

			if (checkLength == true){

			if (activeSequence && globalSelection.length > 0)	{
				app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

				var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
				var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
				var timeTicks	= activeSequence.CTI.ticks;
				var timeString	= activeSequence.CTI.timecode;

				var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
				var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

				var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
				var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

				var projFile = new File(app.project.path);
				var projPath	= app.project.path;
				var projName = app.project.name;
				var projFolder = projPath.slice(0,(projPath.length-projName.length));

				var f = new Folder(projFolder + 'Export/Protools/' + timeStamp);
	    	if (!f.exists)
	      	f.create();
				var outputPath  = f;

				if ((outputPath) && projFile.exists){

					var presetName = "Prores ProTools";

					var outPreset		= new File(outputPresetPath + presetName + ".epr");
					if (outPreset.exists === true){
						var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
						if (outputFormatExtension){
							var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

							var fullPathToFile	= 	outputPath.fsName 	+
													$._PPP_.getSep() 	+
													activeSequence.name +
													"." +
													outputFormatExtension;

							var outFileTest = new File(fullPathToFile);

							if (outFileTest.exists){
								var destroyExisting	= confirm("A Protools file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
								if (destroyExisting){
									outFileTest.remove();
									outFileTest.close();
								}
							}

							//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
							app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
							//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
							app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
							app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


							// use these 0 or 1 settings to disable some/all metadata creation.

							app.encoder.setSidecarXMPEnabled(0);
							app.encoder.setEmbeddedXMPEnabled(0);

							/*

							For reference, here's how to export from within PPro (blocking further user interaction).

							var seq = app.project.activeSequence;

							if (seq) {
								seq.exportAsMediaDirect(fullPathToFile,
														outPreset.fsName,
														app.encoder.ENCODE_WORKAREA);

								Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
								var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
							}

							*/

							var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																	fullPathToFile,
																	outPreset.fsName,
																	app.encoder.ENCODE_WORKAREA,
																	1);	   // Remove from queue upon successful completion?
							$._PPP_.updateEventPanel('jobID = ' + jobID);
							outPreset.close();
						}

					} else {
						$._PPP_.updateEventPanel("Could not find output preset.");
					}
				} else {
					$._PPP_.updateEventPanel("Could not find/create output path.");
				}
				projFile.close();
			} else {
				//$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	}
	},

	checkreset : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to change status to 'Nog niet klaar'.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		for (var i = 0; i < selection.length; i++) {
				selection[i].setColorLabel(6)
		}
	},

	checkself : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to change status to 'Klaar'.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		for (var i = 0; i < selection.length; i++) {
				selection[i].setColorLabel(15)
		}
	},

	checkclient : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to change status to 'Goedgekeurd door klant'.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		for (var i = 0; i < selection.length; i++) {
				selection[i].setColorLabel(5)
		}
	},

	renderpreview : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStamp = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + t.toString(); //timestamp for use in folder name
		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

				//Write header for new entry in log file
				var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
				var projNameClean = projName.slice(0,projName.length-7);
				var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
				var checkLogTitle = checkLog(filePath, projNameClean);
				if (!checkLogTitle) {
					writeLog(filePath, logTitle);
				}
				changeLogPreviews(filePath, globalSelection.length);

				var content = "================================================================================\nRender Preview Files - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
				writeLog(filePath, content);
				var previewReason = "Eerste preview" //Set the render reason before the for loop starts, so it won't reset every time during the for loop
				var sameReason = false; //By default it will ask to fill in a reason every render unless this is set to true later on

				var seqName = "";
				var seqLength = "";

				for (var i = 0; i < globalSelection.length; i++) {
					for (var j = 0; j < seqsNum; j++) {
						if (app.project.sequences[j].name == globalSelection[i].name) {
								var openSeq = app.project.sequences[j].id;
								app.project.activeSequence = app.project.sequences[j];
								seqName = globalSelection[i].name;
						}
					}

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					if (app.project.activeSequence.timebase == 10160640000) {
						seqLength = app.project.activeSequence.end/254016000000;
					} else if (app.project.activeSequence.timebase == 10594584000) {
						seqLength = app.project.activeSequence.end/254270016000;
					}
					seqNameLength = seqName.match(/\d+(?=s)/);
					if (seqNameLength > 0){
					//alert(seqLength + " " + seqNameLength); //Length in seconds
						if (seqLength > seqNameLength) {
							seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
							if (seqLengthConfirm){
								checkLength = true;
							}
						} else if (seqLength < seqNameLength) {
							seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
							if (seqLengthConfirm){
								checkLength = true;
							}
						} else {
								checkLength = true;
						}
					} else {
						seqLengthConfirm = confirm("De sequence " + activeSequence.name + " heeft geen lengte in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					}

					if (checkLength == true){
					if (activeSequence && globalSelection.length > 0)	{
						//write current sequence to render log file
						var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
						//Check if sequence has been rendered as preview before
						seqVersion = seqName.match(/(?:v)\d+/i);
						if (seqVersion) {
							factuurConfirm = confirm(activeSequence.name + " heeft een versie nummer in de titel. Moet de preview van deze versie doorberekend worden naar de klant?");
							if (factuurConfirm){
								if (sameReason){
									if (previewReason.match(/(?:v)\d+/i)) {
										previewReason = previewReason.replace(/(?:v)\d+/i, "")
										previewReason = previewReason + seqVersion;
									}
								} else {
									previewReason = prompt("Wat is de reden van deze versie?", "Audiomix " + seqVersion);
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								}
							} else {
								if (sameReason){
									if (previewReason.match(/(?:v)\d+/i)) {
										previewReason = previewReason.replace(/(?:v)\d+/i, "")
										previewReason = previewReason.replace(/NIET DOORBEREKENEN - /i, "")
										previewReason = "NIET DOORBEREKENEN - " + previewReason + seqVersion;
									}
								} else {
									previewReason = prompt("Wat is de reden van deze versie?", "Audiomix " + seqVersion);
									previewReason = "NIET DOORBEREKENEN - " + previewReason;
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								}
							}
						}
						var checkResult = checkLog(filePath, seqName + "_preview.mp4");
						if (checkResult && !seqVersion) {
							//Als er al een preview van deze sequence is gemaakt
							if (!sameReason) {
								factuurConfirm = confirm("Er is al een preview van " + activeSequence.name + ". Moet deze nieuwe preview doorberekend worden naar de klant?");
								if (factuurConfirm){
									previewReason = prompt("Wat is de reden van de nieuwe preview?", "Aanpassing na feedback van klant");
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								} else {
									previewReason = prompt("Wat is de reden van de nieuwe preview?", "Vervanging van vorige preview");
									previewReason = "NIET DOORBEREKENEN - " + previewReason;
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								}
							}
						}

						var content = "- " + seqName + "_preview.mp4 - " + previewReason + "\n";
						writeLog(filePath, content);

						app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

						var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
						var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
						var timeTicks	= activeSequence.CTI.ticks;
						var timeString	= activeSequence.CTI.timecode;

						var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
						var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

						var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
						var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

						var projFile = new File(app.project.path);
						var projPath	= app.project.path;
						var projName = app.project.name;
						var projFolder = projPath.slice(0,(projPath.length-projName.length));

						var f = new Folder(projFolder + 'Export/Previews/' + timeStamp);
			    	if (!f.exists)
			      	f.create();
						var outputPath  = f;

						if ((outputPath) && projFile.exists){

							var sequenceSettings = app.project.activeSequence.getSettings();
							if (sequenceSettings.videoFrameWidth == 1920 && sequenceSettings.videoFrameHeight == 1080) {
								var presetName = "Bake preview 16-9 (normal) 960x540";
							} else if (sequenceSettings.videoFrameWidth == 1080 && sequenceSettings.videoFrameHeight == 1080) {
								var presetName = "Bake preview 1-1 (square) 640x640";
							} else if (sequenceSettings.videoFrameWidth == 1080 && sequenceSettings.videoFrameHeight == 1920) {
								var presetName = "Bake preview 9-16 (vertical) 540x960";
							} else {
								var presetName = "Bake preview (afwijkende formaten)";
							}

							var outPreset		= new File(outputPresetPath + presetName + ".epr");
							if (outPreset.exists === true){
								var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
								if (outputFormatExtension){
									var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

									var fullPathToFile	= 	outputPath.fsName 	+
															$._PPP_.getSep() 	+
															activeSequence.name + "_preview" +
															"." +
															outputFormatExtension;

									var outFileTest = new File(fullPathToFile);

									if (outFileTest.exists){
										var destroyExisting	= confirm("A preview file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
										if (destroyExisting){
											outFileTest.remove();
											outFileTest.close();
										}
									}

									//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
									app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
									//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
									app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
									app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


									// use these 0 or 1 settings to disable some/all metadata creation.

									app.encoder.setSidecarXMPEnabled(0);
									app.encoder.setEmbeddedXMPEnabled(0);

									/*

									For reference, here's how to export from within PPro (blocking further user interaction).

									var seq = app.project.activeSequence;

									if (seq) {
										seq.exportAsMediaDirect(fullPathToFile,
																outPreset.fsName,
																app.encoder.ENCODE_WORKAREA);

										Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
										var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
									}

									*/



									var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																			fullPathToFile,
																			outPreset.fsName,
																			app.encoder.ENCODE_WORKAREA,
																			1);	   // Remove from queue upon successful completion?
									$._PPP_.updateEventPanel('jobID = ' + jobID);
									outPreset.close();
								}
							} else {
								$._PPP_.updateEventPanel("Could not find output preset.");
							}
						} else {
							$._PPP_.updateEventPanel("Could not find/create output path.");
						}
						projFile.close();
					} else {
						//$._PPP_.updateEventPanel("No active sequence.");
						alert("Select one or multiple sequences to export.");
					}
				}
			}

			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

			//Update Klant_Log file
			var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
			generateFilteredLog(filePath, projNr, targetFilePath);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	renderonline : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

			//Write header for new entry in log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var projNameClean = projName.slice(0,projName.length-7);
			var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
			var checkLogTitle = checkLog(filePath, projNameClean);
			if (!checkLogTitle) {
				writeLog(filePath, logTitle);
			}
			var content = "================================================================================\nRender Online Files - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
			writeLog(filePath, content);
			changeLogOnline(filePath, globalSelection.length);
			var onlineReason = "" //Set the render reason before the for loop starts, so it won't reset every time during the for loop
			var sameReason = false; //By default it will ask to fill in a reason every render unless this is set to true later on

			var seqName = "";
			var seqLength = "";

			for (var i = 0; i < globalSelection.length; i++) {
				for (var j = 0; j < seqsNum; j++) {
					if (app.project.sequences[j].name == globalSelection[i].name) {
							var openSeq = app.project.sequences[j].id;
							app.project.activeSequence = app.project.sequences[j];
							seqName = globalSelection[i].name;
					}
				}

				var status = globalSelection[i].getColorLabel();
				if (status == 5) {

					//write current sequence to render log file
					//var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
					//var content = seqName + "\n";
					//writeLog(filePath, content);

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					seqLength = app.project.activeSequence.end/254016000000;
					seqNameLength = seqName.match(/\d+(?=s)/);
					//alert(seqLength + " " + seqNameLength); //Length in seconds
					if (seqLength > seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else if (seqLength < seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else {
							checkLength = true;
					}

					if (checkLength == true){

						if (activeSequence && globalSelection.length > 0)	{

							//write current sequence to render log file
							var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
							//Check if sequence has been rendered as preview before
							var checkResult = checkLog(filePath, seqName + "_high-res.mp4");
							if (checkResult) {
								//Als er al een preview van deze sequence is gemaakt
								if (!sameReason) {
									factuurConfirm = confirm("Er is al een online kopie van " + activeSequence.name + ". Moet deze nieuwe online kopie doorberekend worden naar de klant?");
									if (factuurConfirm){
										onlineReason = prompt("Wat is de reden van de nieuwe online kopie?", "Aanpassing na feedback van klant");
										if (globalSelection.length > 1) {
											sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
										}
									} else {
										onlineReason = prompt("Wat is de reden van de nieuwe online kopie?", "Vervanging van vorige online kopie");
										onlineReason = "NIET DOORBEREKENEN - " + onlineReason;
										if (globalSelection.length > 1) {
											sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
										}
									}
								}
							}

							var koppelTeken = " - ";
							if (onlineReason == "") {
								koppelTeken = "";
							}
							var content = "- " + seqName + "_high-res.mp4" + koppelTeken + onlineReason + "\n";
							writeLog(filePath, content);

							app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

							var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
							var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
							var timeTicks	= activeSequence.CTI.ticks;
							var timeString	= activeSequence.CTI.timecode;

							var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
							var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

							var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
							var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

							var projFile = new File(app.project.path);
							var projPath	= app.project.path;
							var projName = app.project.name;
							var projFolder = projPath.slice(0,(projPath.length-projName.length));

							var f = new Folder(projFolder + 'Export/Online/');
				    	if (!f.exists)
				      	f.create();
							var outputPath  = f;

							if ((outputPath) && projFile.exists){

								presetName = "Bake Online - High-res mp4"

								var outPreset		= new File(outputPresetPath + presetName + ".epr");
								if (outPreset.exists === true){
									var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
									if (outputFormatExtension){
										var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

										var fullPathToFile	= 	outputPath.fsName 	+
																$._PPP_.getSep() 	+
																activeSequence.name + "_high-res" +
																"." +
																outputFormatExtension;

										var outFileTest = new File(fullPathToFile);

										if (outFileTest.exists){
											var destroyExisting	= confirm("A online file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
											if (destroyExisting){
												outFileTest.remove();
												outFileTest.close();
											}
										}

										//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
										app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
										//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
										app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
										app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


										// use these 0 or 1 settings to disable some/all metadata creation.

										app.encoder.setSidecarXMPEnabled(0);
										app.encoder.setEmbeddedXMPEnabled(0);

										/*

										For reference, here's how to export from within PPro (blocking further user interaction).

										var seq = app.project.activeSequence;

										if (seq) {
											seq.exportAsMediaDirect(fullPathToFile,
																	outPreset.fsName,
																	app.encoder.ENCODE_WORKAREA);

											Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
											var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
										}

										*/

										var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																				fullPathToFile,
																				outPreset.fsName,
																				app.encoder.ENCODE_WORKAREA,
																				1);	   // Remove from queue upon successful completion?
										$._PPP_.updateEventPanel('jobID = ' + jobID);
										outPreset.close();
									}
								} else {
									$._PPP_.updateEventPanel("Could not find output preset.");
								}
							} else {
								$._PPP_.updateEventPanel("Could not find/create output path.");
							}
							projFile.close();
						} else {
							$._PPP_.updateEventPanel("No active sequence.");
							alert("Select one or multiple sequences to export.");
						}
					}
				} else {
					alert(seqName + " is nog niet goedgekeurd door de klant!");
				}
			}

			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

			//Update Klant_Log file
			var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
			generateFilteredLog(filePath, projNr, targetFilePath);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	rendermaster : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

			//Write header for new entry in log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var projNameClean = projName.slice(0,projName.length-7);
			var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
			var checkLogTitle = checkLog(filePath, projNameClean);
			if (!checkLogTitle) {
				writeLog(filePath, logTitle);
			}
			var content = "================================================================================\nRender Prores Files - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
			writeLog(filePath, content);

			var seqName = "";
			var seqLength = "";

			for (var i = 0; i < globalSelection.length; i++) {
				for (var j = 0; j < seqsNum; j++) {
					if (app.project.sequences[j].name == globalSelection[i].name) {
							var openSeq = app.project.sequences[j].id;
							app.project.activeSequence = app.project.sequences[j];
							seqName = globalSelection[i].name;
					}
				}

				var status = globalSelection[i].getColorLabel();
				if (status == 5) {

					//write current sequence to render log file
					var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
					var content = "- " + seqName + "\n";
					writeLog(filePath, content);

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					seqLength = app.project.activeSequence.end/254016000000;
					seqNameLength = seqName.match(/\d+(?=s)/);
					//alert(seqLength + " " + seqNameLength); //Length in seconds
					if (seqLength > seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else if (seqLength < seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else {
							checkLength = true;
					}

					if (checkLength == true){

					if (activeSequence && globalSelection.length > 0)	{
						app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

						var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
						var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
						var timeTicks	= activeSequence.CTI.ticks;
						var timeString	= activeSequence.CTI.timecode;

						var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
						var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

						var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
						var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

						var projFile = new File(app.project.path);
						var projPath	= app.project.path;
						var projName = app.project.name;
						var projFolder = projPath.slice(0,(projPath.length-projName.length));

						var f = new Folder(projFolder + 'Export/Master/');
			    	if (!f.exists)
			      	f.create();
						var outputPath  = f;

						if ((outputPath) && projFile.exists){

							presetName = "Prores 4444 master"

							var outPreset		= new File(outputPresetPath + presetName + ".epr");
							if (outPreset.exists === true){
								var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
								if (outputFormatExtension){
									var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

									var fullPathToFile	= 	outputPath.fsName 	+
															$._PPP_.getSep() 	+
															activeSequence.name +
															"." +
															outputFormatExtension;

									var outFileTest = new File(fullPathToFile);

									if (outFileTest.exists){
										var destroyExisting	= confirm("A master file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
										if (destroyExisting){
											outFileTest.remove();
											outFileTest.close();
										}
									}

									//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
									app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
									//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
									app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
									app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


									// use these 0 or 1 settings to disable some/all metadata creation.

									app.encoder.setSidecarXMPEnabled(0);
									app.encoder.setEmbeddedXMPEnabled(0);

									/*

									For reference, here's how to export from within PPro (blocking further user interaction).

									var seq = app.project.activeSequence;

									if (seq) {
										seq.exportAsMediaDirect(fullPathToFile,
																outPreset.fsName,
																app.encoder.ENCODE_WORKAREA);

										Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
										var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
									}

									*/

									var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																			fullPathToFile,
																			outPreset.fsName,
																			app.encoder.ENCODE_WORKAREA,
																			1);	   // Remove from queue upon successful completion?
									$._PPP_.updateEventPanel('jobID = ' + jobID);
									outPreset.close();
								}
							} else {
								$._PPP_.updateEventPanel("Could not find output preset.");
							}
						} else {
							$._PPP_.updateEventPanel("Could not find/create output path.");
						}
						projFile.close();
					} else {
						$._PPP_.updateEventPanel("No active sequence.");
						alert("Select one or multiple sequences to export.");
					}
				}
			} else {
				alert(seqName + " is nog niet goedgekeurd door de klant!");
			}
			}

			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

			//Update Klant_Log file
			var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
			generateFilteredLog(filePath, projNr, targetFilePath);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	rendermxf : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

			//Write header for new entry in log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var projNameClean = projName.slice(0,projName.length-7);
			var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
			var checkLogTitle = checkLog(filePath, projNameClean);
			if (!checkLogTitle) {
				writeLog(filePath, logTitle);
			}
			var content = "================================================================================\nRender MXF Files - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
			writeLog(filePath, content);
			changeLogMXF(filePath, globalSelection.length);
			var mxfReason = "" //Set the render reason before the for loop starts, so it won't reset every time during the for loop
			var sameReason = false; //By default it will ask to fill in a reason every render unless this is set to true later on

			var seqName = "";
			var seqLength = "";

			for (var i = 0; i < globalSelection.length; i++) {
				for (var j = 0; j < seqsNum; j++) {
					if (app.project.sequences[j].name == globalSelection[i].name) {
							var openSeq = app.project.sequences[j].id;
							app.project.activeSequence = app.project.sequences[j];
							seqName = globalSelection[i].name;
					}
				}

				var status = globalSelection[i].getColorLabel();
				if (status == 5) {

					//write current sequence to render log file
					//var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
					//var content = seqName + "\n";
					//writeLog(filePath, content);

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					seqLength = app.project.activeSequence.end/254016000000;
					seqNameLength = seqName.match(/\d+(?=s)/);
					//alert(seqLength + " " + seqNameLength); //Length in seconds
					if (seqLength > seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else if (seqLength < seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else {
							checkLength = true;
					}

					if (checkLength == true){

					if (activeSequence && globalSelection.length > 0)	{

						//write current sequence to render log file
						var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
						//Check if sequence has been rendered as preview before
						var checkResult = checkLog(filePath, seqName + ".mxf");
						if (checkResult) {
							//Als er al een preview van deze sequence is gemaakt
							if (!sameReason) {
								factuurConfirm = confirm("Er is al een TV kopie van " + activeSequence.name + ". Moet deze nieuwe TV kopie doorberekend worden naar de klant?");
								if (factuurConfirm){
									mxfReason = prompt("Wat is de reden van de nieuwe TV kopie?", "Aanpassing na feedback van klant");
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								} else {
									mxfReason = prompt("Wat is de reden van de nieuwe TV kopie?", "Vervanging van vorige TV kopie");
									mxfReason = "NIET DOORBEREKENEN - " + mxfReason;
									if (globalSelection.length > 1) {
										sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
									}
								}
							}
						}

						var koppelTeken = " - ";
						if (mxfReason == "") {
							koppelTeken = "";
						}
						var content = "- " + seqName + ".mxf" + koppelTeken + mxfReason + "\n";
						writeLog(filePath, content);

						app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

						var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
						var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
						var timeTicks	= activeSequence.CTI.ticks;
						var timeString	= activeSequence.CTI.timecode;

						var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
						var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

						var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
						var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

						var projFile = new File(app.project.path);
						var projPath	= app.project.path;
						var projName = app.project.name;
						var projFolder = projPath.slice(0,(projPath.length-projName.length));

						var f = new Folder(projFolder + 'Export/MXF/');
			    	if (!f.exists)
			      	f.create();
						var outputPath  = f;

						if ((outputPath) && projFile.exists){

							presetName = "MXF uitzendkopie"

							var outPreset		= new File(outputPresetPath + presetName + ".epr");
							if (outPreset.exists === true){
								var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
								if (outputFormatExtension){
									var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

									var fullPathToFile	= 	outputPath.fsName 	+
															$._PPP_.getSep() 	+
															activeSequence.name +
															"." +
															outputFormatExtension;

									var outFileTest = new File(fullPathToFile);

									if (outFileTest.exists){
										var destroyExisting	= confirm("A MXF file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
										if (destroyExisting){
											outFileTest.remove();
											outFileTest.close();
										}
									}

									//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
									app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
									//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
									app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
									app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


									// use these 0 or 1 settings to disable some/all metadata creation.

									app.encoder.setSidecarXMPEnabled(0);
									app.encoder.setEmbeddedXMPEnabled(0);

									/*

									For reference, here's how to export from within PPro (blocking further user interaction).

									var seq = app.project.activeSequence;

									if (seq) {
										seq.exportAsMediaDirect(fullPathToFile,
																outPreset.fsName,
																app.encoder.ENCODE_WORKAREA);

										Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
										var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
									}

									*/

									var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																			fullPathToFile,
																			outPreset.fsName,
																			app.encoder.ENCODE_WORKAREA,
																			1);	   // Remove from queue upon successful completion?
									$._PPP_.updateEventPanel('jobID = ' + jobID);
									outPreset.close();
								}
							} else {
								$._PPP_.updateEventPanel("Could not find output preset.");
							}
						} else {
							$._PPP_.updateEventPanel("Could not find/create output path.");
						}
						projFile.close();
					} else {
						$._PPP_.updateEventPanel("No active sequence.");
						alert("Select one or multiple sequences to export.");
					}
				}
			} else {
				alert(seqName + " is nog niet goedgekeurd door de klant!");
			}
			}
			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

			//Update Klant_Log file
			var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
			generateFilteredLog(filePath, projNr, targetFilePath);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	r128mixdown : function(outputPresetPath) {
		app.enableQE();

		var selectionOk = 1;

		if (globalSelection.length == 0) {
			alert("Select one sequences to export mixdown.");
			selectionOk = 0;
		}

		if (globalSelection.length > 1) {
			alert("Select only one sequences to export mixdown.");
			selectionOk = 0;
		}

		if (selectionOk == 1){
				var seqsNum = 0;
				for (var i = 0; i < 200; i++) {
					if (app.project.sequences[i]) {
						seqsNum += 1;
					} else {
						break;
					}
				}

				var seqName = "";
				var seqLength = "";

				for (var i = 0; i < globalSelection.length; i++) {
					for (var j = 0; j < seqsNum; j++) {
						if (app.project.sequences[j].name == globalSelection[i].name) {
								var openSeq = app.project.sequences[j].id;
								app.project.activeSequence = app.project.sequences[j];
								seqName = globalSelection[i].name;
						}
					}

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					seqLength = app.project.activeSequence.end/254016000000;
					seqNameLength = seqName.match(/\d+(?=s)/);
					//alert(seqLength + " " + seqNameLength); //Length in seconds
					if (seqLength > seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else if (seqLength < seqNameLength) {
						seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					} else {
							checkLength = true;
					}

					if (checkLength == true){

					if (activeSequence && globalSelection.length > 0)	{
						app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

						var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
						var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
						var timeTicks	= activeSequence.CTI.ticks;
						var timeString	= activeSequence.CTI.timecode;

						var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
						var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

						var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
						var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

						var projFile = new File(app.project.path);
						var projPath	= app.project.path;
						var projName = app.project.name;
						var projFolder = projPath.slice(0,(projPath.length-projName.length));

						var f = new Folder(projFolder + 'Audio/R128 Mixdowns/');
			    	if (!f.exists)
			      	f.create();
						var outputPath  = f;

						if ((outputPath) && projFile.exists){

							presetName = "WAV R128 Mixdown"

							var outPreset		= new File(outputPresetPath + presetName + ".epr");
							if (outPreset.exists === true){
								var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
								if (outputFormatExtension){
									var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

									var fullPathToFile	= 	outputPath.fsName 	+
															$._PPP_.getSep() 	+
															activeSequence.name + "_r128_mixdown" +
															"." +
															outputFormatExtension;

									var outFileTest = new File(fullPathToFile);

									if (outFileTest.exists){
										var destroyExisting	= confirm("A R128 mixdown file for " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
										if (destroyExisting){
											outFileTest.remove();
											outFileTest.close();
										}
									}

									app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobCompleteR128);
									app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
									//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
									app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
									app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


									// use these 0 or 1 settings to disable some/all metadata creation.

									app.encoder.setSidecarXMPEnabled(0);
									app.encoder.setEmbeddedXMPEnabled(0);

									/*

									For reference, here's how to export from within PPro (blocking further user interaction).

									var seq = app.project.activeSequence;

									if (seq) {
										seq.exportAsMediaDirect(fullPathToFile,
																outPreset.fsName,
																app.encoder.ENCODE_WORKAREA);

										Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
										var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
									}

									*/

									var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																			fullPathToFile,
																			outPreset.fsName,
																			app.encoder.ENCODE_WORKAREA,
																			1);	   // Remove from queue upon successful completion?
									$._PPP_.updateEventPanel('jobID = ' + jobID);
									outPreset.close();
								}
							} else {
								$._PPP_.updateEventPanel("Could not find output preset.");
							}
						} else {
							$._PPP_.updateEventPanel("Could not find/create output path.");
						}
						projFile.close();
					} else {
						$._PPP_.updateEventPanel("No active sequence.");
						alert("Select one sequences to export mixdown.");
					}
				}
			}
		}
	},

	onlinetvmix : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple audio files to export.");
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

			//Write header for new entry in log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var projNameClean = projName.slice(0,projName.length-7);
			var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
			var checkLogTitle = checkLog(filePath, projNameClean);
			if (!checkLogTitle) {
				writeLog(filePath, logTitle);
			}
			var content = "================================================================================\nRender Audio Online/TV - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
			writeLog(filePath, content);
			changeLogAudio(filePath, globalSelection.length);

			for (var i = 0; i < globalSelection.length; i++) {
				selectedFile = globalSelection[i];

				app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.
				var projFile = new File(app.project.path);
				var projPath	= app.project.path;
				var projName = app.project.name;
				var projFolder = projPath.slice(0,(projPath.length-projName.length));

				//Export TV file
				var f = new Folder(projFolder + 'Export/Audio/TV level R128');
	    	if (!f.exists) {
						f.create();
				}
				var outputPath  = f;
				if ((outputPath) && projFile.exists){
					var presetName = "WAV R128 Mixdown"
					var outPreset		= new File(outputPresetPath + presetName + ".epr");
					if (outPreset.exists === true){
						var outputFormatExtension		=	"wav";
						if (outputFormatExtension){
							var outputFilename	= 	globalSelection[i].name;
							if(/ppm/.test(outputFilename) || /PPM/.test(outputFilename)){
								outputFilename = outputFilename.slice(0,outputFilename.length-8)
							}
							if(/r128/.test(outputFilename) || /R128/.test(outputFilename)){
								outputFilename = outputFilename.slice(0,outputFilename.length-9)
							}
							var fullPathToFile	= 	outputPath.fsName 	+
													$._PPP_.getSep() 	+
													outputFilename +
													"_R128." +
													outputFormatExtension;

							var outFileTest = new File(fullPathToFile);
							if (outFileTest.exists){

								var destroyExisting	= confirm("A audio file with the name " + outputFilename + "_TV." + outputFormatExtension + " already exists. Do you want to overwrite?", false, "Are you sure...?");
								if (destroyExisting){
									outFileTest.remove();
									outFileTest.close();
								}
							}

							//write current audio file to render log file
							var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
							var content = "- " + outputFilename + "_R128\n";
							writeLog(filePath, content);

							//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
							app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
							//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
							app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
							app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);

							app.encoder.setSidecarXMPEnabled(0);
							app.encoder.setEmbeddedXMPEnabled(0);

							var jobID = app.encoder.encodeProjectItem(	selectedFile,
																	fullPathToFile,
																	outPreset.fsName,
																	2,
																	1);	   // Remove from queue upon successful completion?
							$._PPP_.updateEventPanel('jobID = ' + jobID);
							outPreset.close();
						}
					} else {
						$._PPP_.updateEventPanel("Could not find output preset.");
					}
				} else {
					$._PPP_.updateEventPanel("Could not find/create output path.");
				}

				//Export Online file
				var f = new Folder(projFolder + 'Export/Audio/Online level');
	    	if (!f.exists) {
						f.create();
				}
				var outputPath  = f;
				if ((outputPath) && projFile.exists){
					var presetName = "DMS Online level (-14 LUfs)"
					var outPreset		= new File(outputPresetPath + presetName + ".epr");
					if (outPreset.exists === true){
						var outputFormatExtension		=	"wav";
						if (outputFormatExtension){
							var outputFilename	= 	globalSelection[i].name;
							if(/ppm/.test(outputFilename) || /PPM/.test(outputFilename)){
								outputFilename = outputFilename.slice(0,outputFilename.length-8)
							}
							if(/r128/.test(outputFilename) || /R128/.test(outputFilename)){
								outputFilename = outputFilename.slice(0,outputFilename.length-9)
							}
							var fullPathToFile	= 	outputPath.fsName 	+
													$._PPP_.getSep() 	+
													outputFilename +
													"_online-level." +
													outputFormatExtension;

							var outFileTest = new File(fullPathToFile);
							if (outFileTest.exists){
								var destroyExisting	= confirm("A audio file with the name " + outputFilename + "_Online-level." + outputFormatExtension + " already exists. Do you want to overwrite?", false, "Are you sure...?");
								if (destroyExisting){
									outFileTest.remove();
									outFileTest.close();
								}
							}

							//write current audio file to render log file
							var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
							var content = "- " + outputFilename + "_online-level\n";
							writeLog(filePath, content);

							//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
							app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
							//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
							app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
							app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);

							app.encoder.setSidecarXMPEnabled(0);
							app.encoder.setEmbeddedXMPEnabled(0);

							var jobID = app.encoder.encodeProjectItem(	selectedFile,
																	fullPathToFile,
																	outPreset.fsName,
																	2,
																	1);	   // Remove from queue upon successful completion?
							$._PPP_.updateEventPanel('jobID = ' + jobID);
							outPreset.close();
						}
					} else {
						$._PPP_.updateEventPanel("Could not find output preset.");
					}
				} else {
					$._PPP_.updateEventPanel("Could not find/create output path.");
				}

				projFile.close();
			}

			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

			//Update Klant_Log file
			var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
			generateFilteredLog(filePath, projNr, targetFilePath);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	rendercustom : function(outputPresetPath, videoformat, audiolevel) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to export.");
		}

		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var date = new Date();
		var y = date.getFullYear();
		var m = date.getMonth()+1;
		var m = ('0'+m).slice(-2);
		var d = date.getDate();
		var d = ('0'+d).slice(-2);
		var h = date.getHours();
		var h = ('0'+h).slice(-2);
		var t = date.getMinutes();
		var t = ('0'+t).slice(-2);

		var timeStamp = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + t.toString(); //timestamp for use in folder name
		var timeStampLog = y.toString() + "-" + m.toString() + "-" + d.toString() + " " + h.toString() + ":" + t.toString(); //timestamp for use in log file

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		if (/\d{5}/.test(projNr)) {

				//Write header for new entry in log file
				var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
				var projNameClean = projName.slice(0,projName.length-7);
				var logTitle = projNameClean + "\n================================================================================\nAantal previews: 0\nAantal online kopieen: 0\nAantal TV kopieen: 0\nAantal audio mixen: 0\nAantal afwijkende formaten: 0\n================================================================================\n\n\n"
				var checkLogTitle = checkLog(filePath, projNameClean);
				if (!checkLogTitle) {
					writeLog(filePath, logTitle);
				}
				var content = "================================================================================\nRender Afwijkende Files - " + timeStampLog + " - Aantal: " + globalSelection.length + "\n--------------------------------------------------------------------------------\n";
				writeLog(filePath, content);
				var previewReason = "" //Set the render reason before the for loop starts, so it won't reset every time during the for loop
				var sameReason = false; //By default it will ask to fill in a reason every render unless this is set to true later on

				changeLogAfwijkend(filePath, globalSelection.length);

				var seqName = "";
				var seqLength = "";

				for (var i = 0; i < globalSelection.length; i++) {
					for (var j = 0; j < seqsNum; j++) {
						if (app.project.sequences[j].name == globalSelection[i].name) {
								var openSeq = app.project.sequences[j].id;
								app.project.activeSequence = app.project.sequences[j];
								seqName = globalSelection[i].name;
						}
					}

					var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.

					var checkLength = false;
					if (app.project.activeSequence.timebase == 10160640000) {
						seqLength = app.project.activeSequence.end/254016000000;
					} else if (app.project.activeSequence.timebase == 10594584000) {
						seqLength = app.project.activeSequence.end/254270016000;
					}
					seqNameLength = seqName.match(/\d+(?=s)/);
					if (seqNameLength > 0){
					//alert(seqLength + " " + seqNameLength); //Length in seconds
						if (seqLength > seqNameLength) {
							seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is langer dan aangegeven in de titel. Wil je toch renderen?");
							if (seqLengthConfirm){
								checkLength = true;
							}
						} else if (seqLength < seqNameLength) {
							seqLengthConfirm = confirm("De sequence van " + activeSequence.name + " is korter dan aangegeven in de titel. Wil je toch renderen?");
							if (seqLengthConfirm){
								checkLength = true;
							}
						} else {
								checkLength = true;
						}
					} else {
						seqLengthConfirm = confirm("De sequence " + activeSequence.name + " heeft geen lengte in de titel. Wil je toch renderen?");
						if (seqLengthConfirm){
							checkLength = true;
						}
					}

					if (checkLength == true){
					if (activeSequence && globalSelection.length > 0)	{
						//write current sequence to render log file
						var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");

						//Vraag of de render doorberekend moet worden naar de klant
						if (!sameReason) {
							factuurConfirm = confirm("Moet deze render van " + activeSequence.name + " doorberekend worden naar de klant?");
							if (factuurConfirm){
								previewReason = prompt("Wat is de reden van deze afwijkende render?", "Kopie met maximale bestandsgrootte");
								if (globalSelection.length > 1) {
									sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
								}
							} else {
								previewReason = prompt("Wat is de reden om deze render niet door te berekenen?", "Fout van ons in vorige render");
								previewReason = "NIET DOORBEREKENEN - " + previewReason;
								if (globalSelection.length > 1) {
									sameReason = confirm("Wil je dit toepassen op alle renders die je nu gaat maken?");
								}
							}
						}

						app.encoder.launchEncoder();	// This can take a while; let's get the ball rolling.

						var timeSecs	= activeSequence.CTI.secs;		// Just for reference, here's how to access the CTI
						var timeFrames	= activeSequence.CTI.frames;	// (Current Time Indicator), for the active sequence.
						var timeTicks	= activeSequence.CTI.ticks;
						var timeString	= activeSequence.CTI.timecode;

						var seqInPoint	= app.project.activeSequence.getInPoint();	// new in 9.0
						var seqOutPoint	= app.project.activeSequence.getOutPoint();	// new in 9.0

						var seqInPointAsTime = app.project.activeSequence.getInPointAsTime();	// new in 12.0
						var seqOutPointAsTime = app.project.activeSequence.getOutPointAsTime(); // new in 12.0

						var projFile = new File(app.project.path);
						var projPath	= app.project.path;
						var projName = app.project.name;
						var projFolder = projPath.slice(0,(projPath.length-projName.length));

						var f = new Folder(projFolder + 'Export/Afwijkend/' + timeStamp);
			    	if (!f.exists)
			      	f.create();
						var outputPath  = f;

						if ((outputPath) && projFile.exists){

							//Determine what preset to use
							var suffix = "";
							var presetName = "";
							var renderExtension = ".mp4";

							if(videoformat == "h264" && audiolevel == "r128") {
								suffix = "_h264_r128";
								presetName = "h264_r128";
							}
							if(videoformat == "h2642" && audiolevel == "r128") {
								suffix = "_h264_2MB_r128";
								if(seqLength <= 6) { presetName = "h264_2_8_r128"; }
								if(seqLength > 6 && seqLength <= 10) { presetName = "h264_1_5_r128"; }
								if(seqLength > 10) { presetName = "h264_1_0_r128"; }
							}
							if(videoformat == "h2644" && audiolevel == "r128") {
							  suffix = "_h264_4MB_r128";
							  if(seqLength <= 6) { presetName = "h264_4_8_r128"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_2_8_r128"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_1_7_r128"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_1_2_r128"; }
							  if(seqLength > 20) { presetName = "h264_1_0_r128"; }
							}
							if(videoformat == "h2645" && audiolevel == "r128") {
							  suffix = "_h264_5MB_r128";
							  if(seqLength <= 6) { presetName = "h264_6_1_r128"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_3_5_r128"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_2_1_r128"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_1_5_r128"; }
							  if(seqLength > 20) { presetName = "h264_1_0_r128"; }
							}
							if(videoformat == "h26410" && audiolevel == "r128") {
							  suffix = "_h264_10MB_r128";
							  if(seqLength <= 6) { presetName = "h264_12_8_r128"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_7_5_r128"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_4_8_r128"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_3_5_r128"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_2_1_r128"; }
							  if(seqLength > 30) { presetName = "h264_1_0_r128"; }
							}
							if(videoformat == "h26425" && audiolevel == "r128") {
							  suffix = "_h264_25MB_r128";
							  if(seqLength <= 6) { presetName = "h264_32_8_r128"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_19_5_r128"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_12_8_r128"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_9_5_r128"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_6_1_r128"; }
							  if(seqLength > 30 && seqLength <= 60) { presetName = "h264_2_8_r128"; }
							  if(seqLength > 60) { presetName = "h264_1_0_r128"; }
							}
							if(videoformat == "h264100" && audiolevel == "r128") {
							  suffix = "_h264_100MB_r128";
							  if(seqLength <= 15) { presetName = "h264_50_0_r128"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_39_5_r128"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_26_1_r128"; }
							  if(seqLength > 30 && seqLength <= 60) { presetName = "h264_12_8_r128"; }
							  if(seqLength > 60) { presetName = "h264_7_5_r128"; }
							}

							if(videoformat == "h264" && audiolevel == "online") {
							  suffix = "_h264_online";
							  presetName = "h264_online";
							}
							if(videoformat == "h2642" && audiolevel == "online") {
							  suffix = "_h264_2MB_online";
							  if(seqLength <= 6) { presetName = "h264_2_8_online"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_1_5_online"; }
							  if(seqLength > 10) { presetName = "h264_1_0_online"; }
							}
							if(videoformat == "h2644" && audiolevel == "online") {
							  suffix = "_h264_4MB_online";
							  if(seqLength <= 6) { presetName = "h264_4_8_online"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_2_8_online"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_1_7_online"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_1_2_online"; }
							  if(seqLength > 20) { presetName = "h264_1_0_online"; }
							}
							if(videoformat == "h2645" && audiolevel == "online") {
							  suffix = "_h264_5MB_online";
							  if(seqLength <= 6) { presetName = "h264_6_1_online"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_3_5_online"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_2_1_online"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_1_5_online"; }
							  if(seqLength > 20) { presetName = "h264_1_0_online"; }
							}
							if(videoformat == "h26410" && audiolevel == "online") {
							  suffix = "_h264_10MB_online";
							  if(seqLength <= 6) { presetName = "h264_12_8_online"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_7_5_online"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_4_8_online"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_3_5_online"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_2_1_online"; }
							  if(seqLength > 30) { presetName = "h264_1_0_online"; }
							}
							if(videoformat == "h26425" && audiolevel == "online") {
							  suffix = "_h264_25MB_online";
							  if(seqLength <= 6) { presetName = "h264_32_8_online"; }
							  if(seqLength > 6 && seqLength <= 10) { presetName = "h264_19_5_online"; }
							  if(seqLength > 10 && seqLength <= 15) { presetName = "h264_12_8_online"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_9_5_online"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_6_1_online"; }
							  if(seqLength > 30 && seqLength <= 60) { presetName = "h264_2_8_online"; }
							  if(seqLength > 60) { presetName = "h264_1_0_online"; }
							}
							if(videoformat == "h264100" && audiolevel == "online") {
							  suffix = "_h264_100MB_online";
							  if(seqLength <= 15) { presetName = "h264_50_0_online"; }
							  if(seqLength > 15 && seqLength <= 20) { presetName = "h264_39_5_online"; }
							  if(seqLength > 20 && seqLength <= 30) { presetName = "h264_26_1_online"; }
							  if(seqLength > 30 && seqLength <= 60) { presetName = "h264_12_8_online"; }
							  if(seqLength > 60) { presetName = "h264_7_5_online"; }
							}

							if(videoformat == "prores4444" && audiolevel == "r128") {
								suffix = "_prores_4444_r128";
								presetName = "prores_4444_r128";
								renderExtension = ".mov";
							}
							if(videoformat == "prores4444" && audiolevel == "online") {
								suffix = "_prores_4444_online";
								presetName = "prores_4444_online";
								renderExtension = ".mov";
							}

							if(videoformat == "prores422" && audiolevel == "r128") {
								suffix = "_prores_422_r128";
								presetName = "prores_422_r128";
								renderExtension = ".mov";
							}
							if(videoformat == "prores422" && audiolevel == "online") {
								suffix = "_prores_422_online";
								presetName = "prores_422_online";
								renderExtension = ".mov";
							}

							if(videoformat == "png") {
								suffix = "_png";
								presetName = "png_sequence";
								renderExtension = ".png";
							}

							if(videoformat == "tiff") {
								suffix = "_tiff";
								presetName = "tiff_sequence";
								renderExtension = ".tiff";
							}

							//Write new line in log file for this render
							var content = "- " + seqName + suffix + renderExtension +" - " + previewReason + "\n";
							writeLog(filePath, content);

							var outPreset		= new File(outputPresetPath + presetName + ".epr");
							if (outPreset.exists === true){
								var outputFormatExtension		=	activeSequence.getExportFileExtension(outPreset.fsName);
								if (outputFormatExtension){
									var outputFilename	= 	activeSequence.name + '.' + outputFormatExtension;

									var fullPathToFile	= 	outputPath.fsName 	+
															$._PPP_.getSep() 	+
															activeSequence.name + suffix +
															"." +
															outputFormatExtension;

									var outFileTest = new File(fullPathToFile);

									if (outFileTest.exists){
										var destroyExisting	= confirm("A file with the name " + activeSequence.name + " already exists. Do you want to overwrite?", false, "Are you sure...?");
										if (destroyExisting){
											outFileTest.remove();
											outFileTest.close();
										}
									}

									//app.encoder.bind('onEncoderJobComplete',	$._PPP_.onEncoderJobComplete);
									app.encoder.bind('onEncoderJobError', 		$._PPP_.onEncoderJobError);
									//app.encoder.bind('onEncoderJobProgress', 	$._PPP_.onEncoderJobProgress);
									app.encoder.bind('onEncoderJobQueued', 		$._PPP_.onEncoderJobQueued);
									app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);


									// use these 0 or 1 settings to disable some/all metadata creation.

									app.encoder.setSidecarXMPEnabled(0);
									app.encoder.setEmbeddedXMPEnabled(0);

									/*

									For reference, here's how to export from within PPro (blocking further user interaction).

									var seq = app.project.activeSequence;

									if (seq) {
										seq.exportAsMediaDirect(fullPathToFile,
																outPreset.fsName,
																app.encoder.ENCODE_WORKAREA);

										Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
										var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
									}

									*/



									var jobID = app.encoder.encodeSequence(	app.project.activeSequence,
																			fullPathToFile,
																			outPreset.fsName,
																			app.encoder.ENCODE_WORKAREA,
																			1);	   // Remove from queue upon successful completion?
									$._PPP_.updateEventPanel('jobID = ' + jobID);
									outPreset.close();
								}
							} else {
								$._PPP_.updateEventPanel("Could not find output preset.");
							}
						} else {
							$._PPP_.updateEventPanel("Could not find/create output path.");
						}
						projFile.close();
					} else {
						//$._PPP_.updateEventPanel("No active sequence.");
						alert("Select one or multiple sequences to export.");
					}
				}
			}

			//write empty line to render log file
			var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
			var content = "\n";
			writeLog(filePath, content);

		} else {
			alert("De naam van dit project begint niet met het projectnummer. Zorg ervoor dat deze aan het begin van de naam staat en probeer opnieuw.");
		}
	},

	todatum : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to DATUM.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();
				var dateVersion = "";

				if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "DATUM";
					dateVersion = "DATUM";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "DATUM";
					dateVersion = "WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "DATUM";
					dateVersion = "DONDERDAG";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "DATUM";
					dateVersion = "MORGEN";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "DATUM";
					dateVersion = "NU";
				} else {
					app.project.activeSequence.name = seqName + " DATUM";
				}

				//REPLACE FOOTAGE
				var checkTracks = 10; //Amount of tracks to check
				var checkBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingFiles = 0;

				for (m=0; m < checkTracks; m++){
						var myTrack = app.project.activeSequence.videoTracks[m];
						if (myTrack) {
								var checkClips = myTrack.clips.numItems;
								for (j=0; j < checkClips; j++){
										var myClip = myTrack.clips[j];
										var myClipName = myClip.name;
										var myClipExtension = myClipName.slice(myClipName.length-4,myClipName.length);
										myClipName = myClipName.slice(0,myClipName.length-4);
										if (myClipName.slice(myClipName.length-5,myClipName.length) == "00000") {
											myClipName = myClipName.slice(0,myClipName.length-6); //remove numbers + underscore
											myClipExtension = "_00000" + myClipExtension; //Add number + underscore to extension so it will be put back at the end of the name
										}
										if (myClipName.slice(myClipName.length-dateVersion.length,myClipName.length) == dateVersion) {
											  var clipReplaced = 0;
												myReplaceClipName = myClipName.slice(0,myClipName.length-dateVersion.length) + "DATUM" + myClipExtension;
												for (k=0; k < checkBins; k++) {
														myBin = app.project.rootItem.children[k];
														if(myBin.name == "AE"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myBin.children[l].name == "16x9"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "9x16"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "1x1"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else {
																			//Is not a bin
																				var myItem = myBin.children[l];
																				var myItemName = myItem.name;
																				//alert(myItemName + " " + myReplaceClipName);
																				if (myItemName == myReplaceClipName) {
																						myClip.projectItem = myItem;
																						clipReplaced = 1;
																				}
																		}
																}
														}
												}
										}
										if (clipReplaced == 0) {
											alert("'" + myReplaceClipName + "' staat niet in de AE map.")
											missingFiles += 1;
										}
								}
						}
				}
				if (missingFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}
				//REPLACE AUDIO
				var checkAudioTracks = 4; //Amount of tracks to check
				var checkAudioBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingAudioFiles = 0;

				for (m=0; m < checkAudioTracks; m++){
						var myAudioTrack = app.project.activeSequence.audioTracks[m];
						if (myAudioTrack) {
								var checkAudioClips = myAudioTrack.clips.numItems;
								for (j=0; j < checkAudioClips; j++){
										var myAudioClip = myAudioTrack.clips[j];
										var myAudioClipName = myAudioClip.name;
										var myAudioClipNameObj = {filmName: "",
																							createDate: "",
																							createTime: "",
																							spotName: "",
																							duration: "",
																							lang: "",
																							version: "",
																							release: "",
																							releaseDate: "",
																							norm: "",
																							extension: ""};
										myAudioClipNameObj.extension = myAudioClipName.slice(myAudioClipName.length-4,myAudioClipName.length);
										//alert(myAudioClipNameObj.extension);
										myAudioClipName = myAudioClipName.slice(0,myAudioClipName.length-4);
										var stringCutter = 1;
										var cutStage = 0;
										while (stringCutter == 1){
												indexU = myAudioClipName.indexOf("_");
												if (indexU > 0) {
														cutPart = myAudioClipName.slice(0,indexU);
														myAudioClipName = myAudioClipName.slice(indexU+1,myAudioClipName.length);
												}
												if (indexU < 0) {
														stringCutter = 0;
														cutPart = myAudioClipName
												}
												//alert(cutPart);
												//alert(cutStage);
												cutPart = cutPart.toUpperCase()
												switch (cutStage) {
														case 0:
																if (/\d{6}/.test(cutPart)) {
																		myAudioClipNameObj.createDate = cutPart;
																		cutStage = 1;
																} else {
																		if (myAudioClipNameObj.filmName == "") {
																				myAudioClipNameObj.filmName = cutPart;
																		} else {
																				myAudioClipNameObj.filmName = myAudioClipNameObj.filmName + "_" + cutPart;
																		}
																}
																break;
														case 1:
																if (/\d{4}/.test(cutPart)) {
																		myAudioClipNameObj.createTime = cutPart;
																		cutStage = 2;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																		cutStage = 2;
																}
																break;
														case 2:
																if (/\d+[S]/.test(cutPart)) {
																		myAudioClipNameObj.duration = cutPart;
																		cutStage = 3;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																}
																break;
														case 3:
																if (cutPart == "OV" || cutPart == "NL") {
																		myAudioClipNameObj.lang = cutPart;
																		cutStage = 4;
																} else if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 4:
																if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 5:
																if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																} else {
																		myAudioClipNameObj.release = "DATUM";
																		cutStage = 6;
																}
																break;
														case 6:
																if (myAudioClipNameObj.release == "DATUM") {
																	 	myAudioClipNameObj.releaseDate = cutPart;
																	 	cutStage = 7;
																} else {
																		myAudioClipNameObj.norm = cutPart;
																}
																break;
														case 7:
																myAudioClipNameObj.norm = cutPart;
																break;
												}
										}

										var searchString = myAudioClipNameObj.spotName + "_" + myAudioClipNameObj.duration + "_";
										if (!myAudioClipNameObj.lang == "") {
												searchString = searchString + myAudioClipNameObj.lang + "_";
										}
										if (!myAudioClipNameObj.version == "") {
												searchString = searchString + myAudioClipNameObj.version + "_";
										}
										searchString = searchString + "Datum";

										/*
										alert("Film Name: " + myAudioClipNameObj.filmName + "\r\n" +
													" Creation Date: " + myAudioClipNameObj.createDate + "\r\n" +
													" Creation Time: " + myAudioClipNameObj.createTime + "\r\n" +
													" Spot Name: " + myAudioClipNameObj.spotName + "\r\n" +
													" Duration: " + myAudioClipNameObj.duration + "\r\n" +
													" Language: " + myAudioClipNameObj.lang + "\r\n" +
													" Version: " + myAudioClipNameObj.version + "\r\n" +
													" Release: " + myAudioClipNameObj.release + "\r\n" +
													" Release Date: " + myAudioClipNameObj.releaseDate + "\r\n" +
													" Norm: " + myAudioClipNameObj.norm + "\r\n" +
													" Extension: " + myAudioClipNameObj.extension + "\r\n\r\n" +
													" Search String: " + searchString);
										*/


										var myAudioReplaceClip = 0;
										var myAudioItemDate = 0;
										var myAudioReplaceClipDate = 0;
										if (myAudioClipNameObj.release.toUpperCase() == dateVersion) {
											  var clipAudioReplaced = 0;
												for (k=0; k < checkAudioBins; k++) {
														myAudioBin = app.project.rootItem.children[k];
														if(myAudioBin.name == "Audio"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myAudioBin.children[l].type == "2"){ //Check if item is a bin
																			  //alert("bin");
																				var checkSubItems = myAudioBin.children[l].children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[l].children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				} //////////////////Good till here//////////////////
																		} else { //No bin
																				var checkSubItems = myAudioBin.children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				}
																		}
																}
														}
												}
										}
										if (myAudioReplaceClip != 0){
											myAudioClip.projectItem = myAudioReplaceClip;
											clipAudioReplaced = 1;
										}
										if (clipAudioReplaced == 0) {
											alert("Kan geen audio bestand met '" + searchString + "' in de naam vinden. Zorg dat de juiste audio bestanden in de 'Audio' map staan en probeer opnieuw.");
											missingAudioFiles += 1;
										}
								}
						}
				}
				if (missingAudioFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	towoensdag : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to DATUM.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();
				var dateVersion = "";

				if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "WOENSDAG";
					dateVersion = "DATUM";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "WOENSDAG";
					dateVersion = "WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "WOENSDAG";
					dateVersion = "DONDERDAG";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "WOENSDAG";
					dateVersion = "MORGEN";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "WOENSDAG";
					dateVersion = "NU";
				} else {
					app.project.activeSequence.name = seqName + " WOENSDAG";
				}

				//REPLACE FOOTAGE
				var checkTracks = 10; //Amount of tracks to check
				var checkBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingFiles = 0;

				for (m=0; m < checkTracks; m++){
						var myTrack = app.project.activeSequence.videoTracks[m];
						if (myTrack) {
								var checkClips = myTrack.clips.numItems;
								for (j=0; j < checkClips; j++){
										var myClip = myTrack.clips[j];
										var myClipName = myClip.name;
										var myClipExtension = myClipName.slice(myClipName.length-4,myClipName.length);
										myClipName = myClipName.slice(0,myClipName.length-4);
										if (myClipName.slice(myClipName.length-5,myClipName.length) == "00000") {
											myClipName = myClipName.slice(0,myClipName.length-6); //remove numbers + underscore
											myClipExtension = "_00000" + myClipExtension; //Add number + underscore to extension so it will be put back at the end of the name
										}
										if (myClipName.slice(myClipName.length-dateVersion.length,myClipName.length) == dateVersion) {
											  var clipReplaced = 0;
												myReplaceClipName = myClipName.slice(0,myClipName.length-dateVersion.length) + "WOENSDAG" + myClipExtension;
												for (k=0; k < checkBins; k++) {
														myBin = app.project.rootItem.children[k];
														if(myBin.name == "AE"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myBin.children[l].name == "16x9"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "9x16"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "1x1"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else {
																			//Is not a bin
																				var myItem = myBin.children[l];
																				var myItemName = myItem.name;
																				//alert(myItemName + " " + myReplaceClipName);
																				if (myItemName == myReplaceClipName) {
																						myClip.projectItem = myItem;
																						clipReplaced = 1;
																				}
																		}
																}
														}
												}
										}
										if (clipReplaced == 0) {
											alert("'" + myReplaceClipName + "' staat niet in de AE map.")
											missingFiles += 1;
										}
								}
						}
				}
				if (missingFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}
				//REPLACE AUDIO
				var checkAudioTracks = 4; //Amount of tracks to check
				var checkAudioBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingAudioFiles = 0;

				for (m=0; m < checkAudioTracks; m++){
						var myAudioTrack = app.project.activeSequence.audioTracks[m];
						if (myAudioTrack) {
								var checkAudioClips = myAudioTrack.clips.numItems;
								for (j=0; j < checkAudioClips; j++){
										var myAudioClip = myAudioTrack.clips[j];
										var myAudioClipName = myAudioClip.name;
										var myAudioClipNameObj = {filmName: "",
																							createDate: "",
																							createTime: "",
																							spotName: "",
																							duration: "",
																							lang: "",
																							version: "",
																							release: "",
																							releaseDate: "",
																							norm: "",
																							extension: ""};
										myAudioClipNameObj.extension = myAudioClipName.slice(myAudioClipName.length-4,myAudioClipName.length);
										//alert(myAudioClipNameObj.extension);
										myAudioClipName = myAudioClipName.slice(0,myAudioClipName.length-4);
										var stringCutter = 1;
										var cutStage = 0;
										while (stringCutter == 1){
												indexU = myAudioClipName.indexOf("_");
												if (indexU > 0) {
														cutPart = myAudioClipName.slice(0,indexU);
														myAudioClipName = myAudioClipName.slice(indexU+1,myAudioClipName.length);
												}
												if (indexU < 0) {
														stringCutter = 0;
														cutPart = myAudioClipName
												}
												//alert(cutPart);
												//alert(cutStage);
												cutPart = cutPart.toUpperCase()
												switch (cutStage) {
														case 0:
																if (/\d{6}/.test(cutPart)) {
																		myAudioClipNameObj.createDate = cutPart;
																		cutStage = 1;
																} else {
																		if (myAudioClipNameObj.filmName == "") {
																				myAudioClipNameObj.filmName = cutPart;
																		} else {
																				myAudioClipNameObj.filmName = myAudioClipNameObj.filmName + "_" + cutPart;
																		}
																}
																break;
														case 1:
																if (/\d{4}/.test(cutPart)) {
																		myAudioClipNameObj.createTime = cutPart;
																		cutStage = 2;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																		cutStage = 2;
																}
																break;
														case 2:
																if (/\d+[S]/.test(cutPart)) {
																		myAudioClipNameObj.duration = cutPart;
																		cutStage = 3;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																}
																break;
														case 3:
																if (cutPart == "OV" || cutPart == "NL") {
																		myAudioClipNameObj.lang = cutPart;
																		cutStage = 4;
																} else if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 4:
																if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 5:
																if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																} else {
																		myAudioClipNameObj.release = "DATUM";
																		cutStage = 6;
																}
																break;
														case 6:
																if (myAudioClipNameObj.release == "DATUM") {
																	 	myAudioClipNameObj.releaseDate = cutPart;
																	 	cutStage = 7;
																} else {
																		myAudioClipNameObj.norm = cutPart;
																}
																break;
														case 7:
																myAudioClipNameObj.norm = cutPart;
																break;
												}
										}

										var searchString = myAudioClipNameObj.spotName + "_" + myAudioClipNameObj.duration + "_";
										if (!myAudioClipNameObj.lang == "") {
												searchString = searchString + myAudioClipNameObj.lang + "_";
										}
										if (!myAudioClipNameObj.version == "") {
												searchString = searchString + myAudioClipNameObj.version + "_";
										}
										searchString = searchString + "Woensdag";

										/*
										alert("Film Name: " + myAudioClipNameObj.filmName + "\r\n" +
													" Creation Date: " + myAudioClipNameObj.createDate + "\r\n" +
													" Creation Time: " + myAudioClipNameObj.createTime + "\r\n" +
													" Spot Name: " + myAudioClipNameObj.spotName + "\r\n" +
													" Duration: " + myAudioClipNameObj.duration + "\r\n" +
													" Language: " + myAudioClipNameObj.lang + "\r\n" +
													" Version: " + myAudioClipNameObj.version + "\r\n" +
													" Release: " + myAudioClipNameObj.release + "\r\n" +
													" Release Date: " + myAudioClipNameObj.releaseDate + "\r\n" +
													" Norm: " + myAudioClipNameObj.norm + "\r\n" +
													" Extension: " + myAudioClipNameObj.extension + "\r\n\r\n" +
													" Search String: " + searchString);
										*/


										var myAudioReplaceClip = 0;
										var myAudioItemDate = 0;
										var myAudioReplaceClipDate = 0;
										if (myAudioClipNameObj.release.toUpperCase() == dateVersion) {
											  var clipAudioReplaced = 0;
												for (k=0; k < checkAudioBins; k++) {
														myAudioBin = app.project.rootItem.children[k];
														if(myAudioBin.name == "Audio"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myAudioBin.children[l].type == "2"){ //Check if item is a bin
																			  //alert("bin");
																				var checkSubItems = myAudioBin.children[l].children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[l].children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				} //////////////////Good till here//////////////////
																		} else { //No bin
																				var checkSubItems = myAudioBin.children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				}
																		}
																}
														}
												}
										}
										if (myAudioReplaceClip != 0){
											myAudioClip.projectItem = myAudioReplaceClip;
											clipAudioReplaced = 1;
										}
										if (clipAudioReplaced == 0) {
											alert("Kan geen audio bestand met '" + searchString + "' in de naam vinden. Zorg dat de juiste audio bestanden in de 'Audio' map staan en probeer opnieuw.");
											missingAudioFiles += 1;
										}
								}
						}
				}
				if (missingAudioFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	todonderdag : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to DONDERDAG.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();
				var dateVersion = "";

				if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "DONDERDAG";
					dateVersion = "DATUM";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "DONDERDAG";
					dateVersion = "WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "DONDERDAG";
					dateVersion = "DONDERDAG";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "DONDERDAG";
					dateVersion = "MORGEN";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "DONDERDAG";
					dateVersion = "NU";
				} else {
					app.project.activeSequence.name = seqName + " DONDERDAG";
				}

				//REPLACE FOOTAGE
				var checkTracks = 10; //Amount of tracks to check
				var checkBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingFiles = 0;

				for (m=0; m < checkTracks; m++){
						var myTrack = app.project.activeSequence.videoTracks[m];
						if (myTrack) {
								var checkClips = myTrack.clips.numItems;
								for (j=0; j < checkClips; j++){
										var myClip = myTrack.clips[j];
										var myClipName = myClip.name;
										var myClipExtension = myClipName.slice(myClipName.length-4,myClipName.length);
										myClipName = myClipName.slice(0,myClipName.length-4);
										if (myClipName.slice(myClipName.length-5,myClipName.length) == "00000") {
											myClipName = myClipName.slice(0,myClipName.length-6); //remove numbers + underscore
											myClipExtension = "_00000" + myClipExtension; //Add number + underscore to extension so it will be put back at the end of the name
										}
										if (myClipName.slice(myClipName.length-dateVersion.length,myClipName.length) == dateVersion) {
											  var clipReplaced = 0;
												myReplaceClipName = myClipName.slice(0,myClipName.length-dateVersion.length) + "DONDERDAG" + myClipExtension;
												for (k=0; k < checkBins; k++) {
														myBin = app.project.rootItem.children[k];
														if(myBin.name == "AE"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myBin.children[l].name == "16x9"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "9x16"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "1x1"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else {
																			//Is not a bin
																				var myItem = myBin.children[l];
																				var myItemName = myItem.name;
																				//alert(myItemName + " " + myReplaceClipName);
																				if (myItemName == myReplaceClipName) {
																						myClip.projectItem = myItem;
																						clipReplaced = 1;
																				}
																		}
																}
														}
												}
										}
										if (clipReplaced == 0) {
											alert("'" + myReplaceClipName + "' staat niet in de AE map.")
											missingFiles += 1;
										}
								}
						}
				}
				if (missingFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}
				//REPLACE AUDIO
				var checkAudioTracks = 4; //Amount of tracks to check
				var checkAudioBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingAudioFiles = 0;

				for (m=0; m < checkAudioTracks; m++){
						var myAudioTrack = app.project.activeSequence.audioTracks[m];
						if (myAudioTrack) {
								var checkAudioClips = myAudioTrack.clips.numItems;
								for (j=0; j < checkAudioClips; j++){
										var myAudioClip = myAudioTrack.clips[j];
										var myAudioClipName = myAudioClip.name;
										var myAudioClipNameObj = {filmName: "",
																							createDate: "",
																							createTime: "",
																							spotName: "",
																							duration: "",
																							lang: "",
																							version: "",
																							release: "",
																							releaseDate: "",
																							norm: "",
																							extension: ""};
										myAudioClipNameObj.extension = myAudioClipName.slice(myAudioClipName.length-4,myAudioClipName.length);
										//alert(myAudioClipNameObj.extension);
										myAudioClipName = myAudioClipName.slice(0,myAudioClipName.length-4);
										var stringCutter = 1;
										var cutStage = 0;
										while (stringCutter == 1){
												indexU = myAudioClipName.indexOf("_");
												if (indexU > 0) {
														cutPart = myAudioClipName.slice(0,indexU);
														myAudioClipName = myAudioClipName.slice(indexU+1,myAudioClipName.length);
												}
												if (indexU < 0) {
														stringCutter = 0;
														cutPart = myAudioClipName
												}
												//alert(cutPart);
												//alert(cutStage);
												cutPart = cutPart.toUpperCase()
												switch (cutStage) {
														case 0:
																if (/\d{6}/.test(cutPart)) {
																		myAudioClipNameObj.createDate = cutPart;
																		cutStage = 1;
																} else {
																		if (myAudioClipNameObj.filmName == "") {
																				myAudioClipNameObj.filmName = cutPart;
																		} else {
																				myAudioClipNameObj.filmName = myAudioClipNameObj.filmName + "_" + cutPart;
																		}
																}
																break;
														case 1:
																if (/\d{4}/.test(cutPart)) {
																		myAudioClipNameObj.createTime = cutPart;
																		cutStage = 2;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																		cutStage = 2;
																}
																break;
														case 2:
																if (/\d+[S]/.test(cutPart)) {
																		myAudioClipNameObj.duration = cutPart;
																		cutStage = 3;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																}
																break;
														case 3:
																if (cutPart == "OV" || cutPart == "NL") {
																		myAudioClipNameObj.lang = cutPart;
																		cutStage = 4;
																} else if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 4:
																if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 5:
																if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																} else {
																		myAudioClipNameObj.release = "DATUM";
																		cutStage = 6;
																}
																break;
														case 6:
																if (myAudioClipNameObj.release == "DATUM") {
																	 	myAudioClipNameObj.releaseDate = cutPart;
																	 	cutStage = 7;
																} else {
																		myAudioClipNameObj.norm = cutPart;
																}
																break;
														case 7:
																myAudioClipNameObj.norm = cutPart;
																break;
												}
										}

										var searchString = myAudioClipNameObj.spotName + "_" + myAudioClipNameObj.duration + "_";
										if (!myAudioClipNameObj.lang == "") {
												searchString = searchString + myAudioClipNameObj.lang + "_";
										}
										if (!myAudioClipNameObj.version == "") {
												searchString = searchString + myAudioClipNameObj.version + "_";
										}
										searchString = searchString + "Donderdag";

										/*
										alert("Film Name: " + myAudioClipNameObj.filmName + "\r\n" +
													" Creation Date: " + myAudioClipNameObj.createDate + "\r\n" +
													" Creation Time: " + myAudioClipNameObj.createTime + "\r\n" +
													" Spot Name: " + myAudioClipNameObj.spotName + "\r\n" +
													" Duration: " + myAudioClipNameObj.duration + "\r\n" +
													" Language: " + myAudioClipNameObj.lang + "\r\n" +
													" Version: " + myAudioClipNameObj.version + "\r\n" +
													" Release: " + myAudioClipNameObj.release + "\r\n" +
													" Release Date: " + myAudioClipNameObj.releaseDate + "\r\n" +
													" Norm: " + myAudioClipNameObj.norm + "\r\n" +
													" Extension: " + myAudioClipNameObj.extension + "\r\n\r\n" +
													" Search String: " + searchString);
										*/


										var myAudioReplaceClip = 0;
										var myAudioItemDate = 0;
										var myAudioReplaceClipDate = 0;
										if (myAudioClipNameObj.release.toUpperCase() == dateVersion) {
											  var clipAudioReplaced = 0;
												for (k=0; k < checkAudioBins; k++) {
														myAudioBin = app.project.rootItem.children[k];
														if(myAudioBin.name == "Audio"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myAudioBin.children[l].type == "2"){ //Check if item is a bin
																			  //alert("bin");
																				var checkSubItems = myAudioBin.children[l].children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[l].children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				} //////////////////Good till here//////////////////
																		} else { //No bin
																				var checkSubItems = myAudioBin.children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				}
																		}
																}
														}
												}
										}
										if (myAudioReplaceClip != 0){
											myAudioClip.projectItem = myAudioReplaceClip;
											clipAudioReplaced = 1;
										}
										if (clipAudioReplaced == 0) {
											alert("Kan geen audio bestand met '" + searchString + "' in de naam vinden. Zorg dat de juiste audio bestanden in de 'Audio' map staan en probeer opnieuw.");
											missingAudioFiles += 1;
										}
								}
						}
				}
				if (missingAudioFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	tomorgen : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to MORGEN.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();
				var dateVersion = "";

				if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "MORGEN";
					dateVersion = "DATUM";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "MORGEN";
					dateVersion = "WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "MORGEN";
					dateVersion = "DONDERDAG";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "MORGEN";
					dateVersion = "MORGEN";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "MORGEN";
					dateVersion = "NU";
				} else {
					app.project.activeSequence.name = seqName + " MORGEN";
				}

				//REPLACE FOOTAGE
				var checkTracks = 10; //Amount of tracks to check
				var checkBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingFiles = 0;

				for (m=0; m < checkTracks; m++){
						var myTrack = app.project.activeSequence.videoTracks[m];
						if (myTrack) {
								var checkClips = myTrack.clips.numItems;
								for (j=0; j < checkClips; j++){
										var myClip = myTrack.clips[j];
										var myClipName = myClip.name;
										var myClipExtension = myClipName.slice(myClipName.length-4,myClipName.length);
										myClipName = myClipName.slice(0,myClipName.length-4);
										if (myClipName.slice(myClipName.length-5,myClipName.length) == "00000") {
											myClipName = myClipName.slice(0,myClipName.length-6); //remove numbers + underscore
											myClipExtension = "_00000" + myClipExtension; //Add number + underscore to extension so it will be put back at the end of the name
										}
										if (myClipName.slice(myClipName.length-dateVersion.length,myClipName.length) == dateVersion) {
											  var clipReplaced = 0;
												myReplaceClipName = myClipName.slice(0,myClipName.length-dateVersion.length) + "MORGEN" + myClipExtension;
												for (k=0; k < checkBins; k++) {
														myBin = app.project.rootItem.children[k];
														if(myBin.name == "AE"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myBin.children[l].name == "16x9"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "9x16"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "1x1"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else {
																			//Is not a bin
																				var myItem = myBin.children[l];
																				var myItemName = myItem.name;
																				//alert(myItemName + " " + myReplaceClipName);
																				if (myItemName == myReplaceClipName) {
																						myClip.projectItem = myItem;
																						clipReplaced = 1;
																				}
																		}
																}
														}
												}
										}
										if (clipReplaced == 0) {
											alert("'" + myReplaceClipName + "' staat niet in de AE map.")
											missingFiles += 1;
										}
								}
						}
				}
				if (missingFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}
				//REPLACE AUDIO
				var checkAudioTracks = 4; //Amount of tracks to check
				var checkAudioBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingAudioFiles = 0;

				for (m=0; m < checkAudioTracks; m++){
						var myAudioTrack = app.project.activeSequence.audioTracks[m];
						if (myAudioTrack) {
								var checkAudioClips = myAudioTrack.clips.numItems;
								for (j=0; j < checkAudioClips; j++){
										var myAudioClip = myAudioTrack.clips[j];
										var myAudioClipName = myAudioClip.name;
										var myAudioClipNameObj = {filmName: "",
																							createDate: "",
																							createTime: "",
																							spotName: "",
																							duration: "",
																							lang: "",
																							version: "",
																							release: "",
																							releaseDate: "",
																							norm: "",
																							extension: ""};
										myAudioClipNameObj.extension = myAudioClipName.slice(myAudioClipName.length-4,myAudioClipName.length);
										//alert(myAudioClipNameObj.extension);
										myAudioClipName = myAudioClipName.slice(0,myAudioClipName.length-4);
										var stringCutter = 1;
										var cutStage = 0;
										while (stringCutter == 1){
												indexU = myAudioClipName.indexOf("_");
												if (indexU > 0) {
														cutPart = myAudioClipName.slice(0,indexU);
														myAudioClipName = myAudioClipName.slice(indexU+1,myAudioClipName.length);
												}
												if (indexU < 0) {
														stringCutter = 0;
														cutPart = myAudioClipName
												}
												//alert(cutPart);
												//alert(cutStage);
												cutPart = cutPart.toUpperCase()
												switch (cutStage) {
														case 0:
																if (/\d{6}/.test(cutPart)) {
																		myAudioClipNameObj.createDate = cutPart;
																		cutStage = 1;
																} else {
																		if (myAudioClipNameObj.filmName == "") {
																				myAudioClipNameObj.filmName = cutPart;
																		} else {
																				myAudioClipNameObj.filmName = myAudioClipNameObj.filmName + "_" + cutPart;
																		}
																}
																break;
														case 1:
																if (/\d{4}/.test(cutPart)) {
																		myAudioClipNameObj.createTime = cutPart;
																		cutStage = 2;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																		cutStage = 2;
																}
																break;
														case 2:
																if (/\d+[S]/.test(cutPart)) {
																		myAudioClipNameObj.duration = cutPart;
																		cutStage = 3;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																}
																break;
														case 3:
																if (cutPart == "OV" || cutPart == "NL") {
																		myAudioClipNameObj.lang = cutPart;
																		cutStage = 4;
																} else if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 4:
																if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 5:
																if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																} else {
																		myAudioClipNameObj.release = "DATUM";
																		cutStage = 6;
																}
																break;
														case 6:
																if (myAudioClipNameObj.release == "DATUM") {
																	 	myAudioClipNameObj.releaseDate = cutPart;
																	 	cutStage = 7;
																} else {
																		myAudioClipNameObj.norm = cutPart;
																}
																break;
														case 7:
																myAudioClipNameObj.norm = cutPart;
																break;
												}
										}

										var searchString = myAudioClipNameObj.spotName + "_" + myAudioClipNameObj.duration + "_";
										if (!myAudioClipNameObj.lang == "") {
												searchString = searchString + myAudioClipNameObj.lang + "_";
										}
										if (!myAudioClipNameObj.version == "") {
												searchString = searchString + myAudioClipNameObj.version + "_";
										}
										searchString = searchString + "Morgen";

										/*
										alert("Film Name: " + myAudioClipNameObj.filmName + "\r\n" +
													" Creation Date: " + myAudioClipNameObj.createDate + "\r\n" +
													" Creation Time: " + myAudioClipNameObj.createTime + "\r\n" +
													" Spot Name: " + myAudioClipNameObj.spotName + "\r\n" +
													" Duration: " + myAudioClipNameObj.duration + "\r\n" +
													" Language: " + myAudioClipNameObj.lang + "\r\n" +
													" Version: " + myAudioClipNameObj.version + "\r\n" +
													" Release: " + myAudioClipNameObj.release + "\r\n" +
													" Release Date: " + myAudioClipNameObj.releaseDate + "\r\n" +
													" Norm: " + myAudioClipNameObj.norm + "\r\n" +
													" Extension: " + myAudioClipNameObj.extension + "\r\n\r\n" +
													" Search String: " + searchString);
										*/


										var myAudioReplaceClip = 0;
										var myAudioItemDate = 0;
										var myAudioReplaceClipDate = 0;
										if (myAudioClipNameObj.release.toUpperCase() == dateVersion) {
											  var clipAudioReplaced = 0;
												for (k=0; k < checkAudioBins; k++) {
														myAudioBin = app.project.rootItem.children[k];
														if(myAudioBin.name == "Audio"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myAudioBin.children[l].type == "2"){ //Check if item is a bin
																			  //alert("bin");
																				var checkSubItems = myAudioBin.children[l].children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[l].children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				} //////////////////Good till here//////////////////
																		} else { //No bin
																				var checkSubItems = myAudioBin.children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				}
																		}
																}
														}
												}
										}
										if (myAudioReplaceClip != 0){
											myAudioClip.projectItem = myAudioReplaceClip;
											clipAudioReplaced = 1;
										}
										if (clipAudioReplaced == 0) {
											alert("Kan geen audio bestand met '" + searchString + "' in de naam vinden. Zorg dat de juiste audio bestanden in de 'Audio' map staan en probeer opnieuw.");
											missingAudioFiles += 1;
										}
								}
						}
				}
				if (missingAudioFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	tonu : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to NU.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();
				var dateVersion = "";

				if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "NU";
					dateVersion = "DATUM";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "NU";
					dateVersion = "WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "NU";
					dateVersion = "DONDERDAG";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "NU";
					dateVersion = "MORGEN";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "NU";
					dateVersion = "NU";
				} else {
					app.project.activeSequence.name = seqName + " NU";
				}

				//REPLACE FOOTAGE
				var checkTracks = 10; //Amount of tracks to check
				var checkBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingFiles = 0;

				for (m=0; m < checkTracks; m++){
						var myTrack = app.project.activeSequence.videoTracks[m];
						if (myTrack) {
								var checkClips = myTrack.clips.numItems;
								for (j=0; j < checkClips; j++){
										var myClip = myTrack.clips[j];
										var myClipName = myClip.name;
										var myClipExtension = myClipName.slice(myClipName.length-4,myClipName.length);
										myClipName = myClipName.slice(0,myClipName.length-4);
										if (myClipName.slice(myClipName.length-5,myClipName.length) == "00000") {
											myClipName = myClipName.slice(0,myClipName.length-6); //remove numbers + underscore
											myClipExtension = "_00000" + myClipExtension; //Add number + underscore to extension so it will be put back at the end of the name
										}
										if (myClipName.slice(myClipName.length-dateVersion.length,myClipName.length) == dateVersion) {
											  var clipReplaced = 0;
												myReplaceClipName = myClipName.slice(0,myClipName.length-dateVersion.length) + "NU" + myClipExtension;
												for (k=0; k < checkBins; k++) {
														myBin = app.project.rootItem.children[k];
														if(myBin.name == "AE"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myBin.children[l].name == "16x9"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "9x16"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else if(myBin.children[l].name == "1x1"){ //Check if item is a bin
																				var subTest = myBin.children[l].children.numItems;
																				if (subTest > 0) {
																					//Is a bin
																					for (n=0; n < subTest; n++){
																							var myItem = myBin.children[l].children[n];
																							var myItemName = myItem.name;
																							//alert(myItemName + " " + myReplaceClipName);
																							if (myItemName == myReplaceClipName) {
																									myClip.projectItem = myItem;
																									clipReplaced = 1;
																							}
																					}
																				}
																		} else {
																			//Is not a bin
																				var myItem = myBin.children[l];
																				var myItemName = myItem.name;
																				//alert(myItemName + " " + myReplaceClipName);
																				if (myItemName == myReplaceClipName) {
																						myClip.projectItem = myItem;
																						clipReplaced = 1;
																				}
																		}
																}
														}
												}
										}
										if (clipReplaced == 0) {
											alert("'" + myReplaceClipName + "' staat niet in de AE map.");
											missingFiles += 1;
										}
								}
						}
				}
				if (missingFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

				//REPLACE AUDIO
				var checkAudioTracks = 4; //Amount of tracks to check
				var checkAudioBins = app.project.rootItem.children.numItems; //Amount of bins to check for replace clip
				var missingAudioFiles = 0;

				for (m=0; m < checkAudioTracks; m++){
						var myAudioTrack = app.project.activeSequence.audioTracks[m];
						if (myAudioTrack) {
								var checkAudioClips = myAudioTrack.clips.numItems;
								for (j=0; j < checkAudioClips; j++){
										var myAudioClip = myAudioTrack.clips[j];
										var myAudioClipName = myAudioClip.name;
										var myAudioClipNameObj = {filmName: "",
																							createDate: "",
																							createTime: "",
																							spotName: "",
																							duration: "",
																							lang: "",
																							version: "",
																							release: "",
																							releaseDate: "",
																							norm: "",
																							extension: ""};
										myAudioClipNameObj.extension = myAudioClipName.slice(myAudioClipName.length-4,myAudioClipName.length);
										//alert(myAudioClipNameObj.version);
										myAudioClipName = myAudioClipName.slice(0,myAudioClipName.length-4);
										var stringCutter = 1;
										var cutStage = 0;
										while (stringCutter == 1){
												indexU = myAudioClipName.indexOf("_");
												if (indexU > 0) {
														cutPart = myAudioClipName.slice(0,indexU);
														myAudioClipName = myAudioClipName.slice(indexU+1,myAudioClipName.length);
												}
												if (indexU < 0) {
														stringCutter = 0;
														cutPart = myAudioClipName
												}
												//alert(cutPart);
												//alert(cutStage);
												cutPart = cutPart.toUpperCase()
												switch (cutStage) {
														case 0:
																if (/\d{6}/.test(cutPart)) {
																		myAudioClipNameObj.createDate = cutPart;
																		cutStage = 1;
																} else {
																		if (myAudioClipNameObj.filmName == "") {
																				myAudioClipNameObj.filmName = cutPart;
																		} else {
																				myAudioClipNameObj.filmName = myAudioClipNameObj.filmName + "_" + cutPart;
																		}
																}
																break;
														case 1:
																if (/\d{4}/.test(cutPart)) {
																		myAudioClipNameObj.createTime = cutPart;
																		cutStage = 2;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																		cutStage = 2;
																}
																break;
														case 2:
																if (/\d+[S]/.test(cutPart)) {
																		myAudioClipNameObj.duration = cutPart;
																		cutStage = 3;
																} else {
																		if (myAudioClipNameObj.spotName == "") {
																				myAudioClipNameObj.spotName = cutPart;
																		} else {
																				myAudioClipNameObj.spotName = myAudioClipNameObj.spotName + "_" + cutPart;
																		}
																}
																break;
														case 3:
																if (cutPart == "OV" || cutPart == "NL") {
																		myAudioClipNameObj.lang = cutPart;
																		cutStage = 4;
																} else if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5" || cutPart == "V01" || cutPart == "V02" || cutPart == "V03" || cutPart == "V04" || cutPart == "V05") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 4:
																if (cutPart == "V1" || cutPart == "V2" || cutPart == "V3" || cutPart == "V4" || cutPart == "V5" || cutPart == "V01" || cutPart == "V02" || cutPart == "V03" || cutPart == "V04" || cutPart == "V05") {
																		myAudioClipNameObj.version = cutPart;
																		cutStage = 5;
																} else if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																}
																break;
														case 5:
																if (cutPart == "DATUM" || cutPart == "NU" || cutPart == "MORGEN" || cutPart == "WOENSDAG" || cutPart == "DONDERDAG") {
																		myAudioClipNameObj.release = cutPart;
																		cutStage = 6;
																} else {
																		myAudioClipNameObj.release = "DATUM";
																		cutStage = 6;
																}
																break;
														case 6:
																if (myAudioClipNameObj.release == "DATUM") {
																	 	myAudioClipNameObj.releaseDate = cutPart;
																	 	cutStage = 7;
																} else {
																		myAudioClipNameObj.norm = cutPart;
																}
																break;
														case 7:
																myAudioClipNameObj.norm = cutPart;
																break;
												}
										}

										var searchString = myAudioClipNameObj.spotName + "_" + myAudioClipNameObj.duration + "_";
										if (!myAudioClipNameObj.lang == "") {
												searchString = searchString + myAudioClipNameObj.lang + "_";
										}
										if (!myAudioClipNameObj.version == "") {
												searchString = searchString + myAudioClipNameObj.version + "_";
										}
										searchString = searchString + "Nu";

										/*
										alert("Film Name: " + myAudioClipNameObj.filmName + "\r\n" +
													" Creation Date: " + myAudioClipNameObj.createDate + "\r\n" +
													" Creation Time: " + myAudioClipNameObj.createTime + "\r\n" +
													" Spot Name: " + myAudioClipNameObj.spotName + "\r\n" +
													" Duration: " + myAudioClipNameObj.duration + "\r\n" +
													" Language: " + myAudioClipNameObj.lang + "\r\n" +
													" Version: " + myAudioClipNameObj.version + "\r\n" +
													" Release: " + myAudioClipNameObj.release + "\r\n" +
													" Release Date: " + myAudioClipNameObj.releaseDate + "\r\n" +
													" Norm: " + myAudioClipNameObj.norm + "\r\n" +
													" Extension: " + myAudioClipNameObj.extension + "\r\n\r\n" +
													" Search String: " + searchString);
										*/


										var myAudioReplaceClip = 0;
										var myAudioItemDate = 0;
										var myAudioReplaceClipDate = 0;
										if (myAudioClipNameObj.release.toUpperCase() == dateVersion) {
											  var clipAudioReplaced = 0;
												for (k=0; k < checkAudioBins; k++) {
														myAudioBin = app.project.rootItem.children[k];
														if(myAudioBin.name == "Audio"){
																var checkItems = app.project.rootItem.children[k].children.numItems;
																for (l=0; l < checkItems; l++){
																		if(myAudioBin.children[l].type == "2"){ //Check if item is a bin
																			  //alert("bin");
																				var checkSubItems = myAudioBin.children[l].children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[l].children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				} //////////////////Good till here//////////////////
																		} else { //No bin
																				var checkSubItems = myAudioBin.children.numItems;
																				for (m=0; m < checkSubItems; m++){
																						myAudioItem = myAudioBin.children[m];
																						//alert(myAudioItem.name);
																						myAudioItemName = myAudioItem.name.toUpperCase();
																						if(myAudioItemName.indexOf(searchString.toUpperCase()) > -1){
																								myAudioItemDate = myAudioItem.name.match(/\d{6}_\d{4}/);
																								myAudioItemDate = String(myAudioItemDate);
																								myAudioItemDate = myAudioItemDate.replace('_', '');
																								if (myAudioItemDate > myAudioReplaceClipDate){
																										myAudioReplaceClip = myAudioItem;
																										myAudioReplaceClipDate = myAudioItemDate
																										//alert(myAudioReplaceClip.name);
																								}
																						}
																				}
																		}
																}
														}
												}
										}
										if (myAudioReplaceClip != 0){
											myAudioClip.projectItem = myAudioReplaceClip;
											clipAudioReplaced = 1;
										}
										if (clipAudioReplaced == 0) {
											alert("Kan geen audio bestand met '" + searchString + "' in de naam vinden. Zorg dat de juiste audio bestanden in de 'Audio' map staan en probeer opnieuw.");
											missingAudioFiles += 1;
										}
								}
						}
				}
				if (missingAudioFiles > 0){
					app.project.deleteSequence(app.project.activeSequence);
				}

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	tosquare : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to SQUARE.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();

				if (seqName.slice(seqName.length-10,seqName.length) == "16x9 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "1x1 DATUM";
				} else if (seqName.slice(seqName.length-7,seqName.length) == "16x9 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-7) + "1x1 NU";
				} else if (seqName.slice(seqName.length-11,seqName.length) == "16x9 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-11) + "1x1 MORGEN";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "16x9 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "1x1 WOENSDAG";
				} else if (seqName.slice(seqName.length-14,seqName.length) == "16x9 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-14) + "1x1 DONDERDAG";
				} else if (seqName.slice(seqName.length-10,seqName.length) == "9x16 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "1x1 DATUM";
				} else if (seqName.slice(seqName.length-7,seqName.length) == "9x16 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-7) + "1x1 NU";
				} else if (seqName.slice(seqName.length-11,seqName.length) == "9x16 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-11) + "1x1 MORGEN";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "9x16 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "1x1 WOENSDAG";
				} else if (seqName.slice(seqName.length-14,seqName.length) == "9x16 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-14) + "1x1 DONDERDAG";
				} else if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "1x1 DATUM";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "1x1 NU";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "1x1 MORGEN";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "1x1 WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "1x1 DONDERDAG";
				} else {
					app.project.activeSequence.name = seqName + " SQUARE";
				}
				seqSettings = app.project.activeSequence.getSettings();
				seqSettings.videoFrameWidth = 1080;
				seqSettings.videoFrameHeight= 1080;
				app.project.activeSequence.setSettings(seqSettings);

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	tovertical : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to VERTICAL.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();

				if (seqName.slice(seqName.length-10,seqName.length) == "16x9 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "9x16 DATUM";
				} else if (seqName.slice(seqName.length-7,seqName.length) == "16x9 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-7) + "9x16 NU";
				} else if (seqName.slice(seqName.length-11,seqName.length) == "16x9 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-11) + "9x16 MORGEN";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "16x9 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "9x16 WOENSDAG";
				} else if (seqName.slice(seqName.length-14,seqName.length) == "16x9 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-14) + "9x16 DONDERDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "1x1 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "9x16 DATUM";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "1x1 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "9x16 NU";
				} else if (seqName.slice(seqName.length-10,seqName.length) == "1x1 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "9x16 MORGEN";
				} else if (seqName.slice(seqName.length-12,seqName.length) == "1x1 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-12) + "9x16 WOENSDAG";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "1x1 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "9x16 DONDERDAG";
				} else if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "9x16 DATUM";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "9x16 NU";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "9x16 MORGEN";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "9x16 WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "9x16 DONDERDAG";
				} else {
					app.project.activeSequence.name = seqName + " VERTICAL";
				}
				seqSettings = app.project.activeSequence.getSettings();
				seqSettings.videoFrameWidth = 1080;
				seqSettings.videoFrameHeight= 1920;
				app.project.activeSequence.setSettings(seqSettings);

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	to169 : function(outputPresetPath) {
		app.enableQE();

		if (globalSelection.length == 0) {
			alert("Select one or multiple sequences to convert to VERTICAL.");
		}

		var selection = [];
		var selectNum = globalSelection.length;
		for (var i = 0; i < globalSelection.length; i++) {
			selection[i] = globalSelection[i];
		}


		var seqsNum = 0;
		for (var i = 0; i < 200; i++) {
			if (app.project.sequences[i]) {
				seqsNum += 1;
			} else {
				break;
			}
		}

		var seqName = "";

		for (var i = 0; i < selection.length; i++) {
			for (var j = 0; j < seqsNum; j++) {
				if (app.project.sequences[j].name == selection[i].name) {
						var openSeq = app.project.sequences[j].id;
						app.project.activeSequence = app.project.sequences[j]
						seqName = selection[i].name;
				}
			}

			var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
			if (activeSequence && selection.length > 0)	{

				var newSeq = app.project.activeSequence.clone();

				if (seqName.slice(seqName.length-9,seqName.length) == "1x1 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "16x9 DATUM";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "1x1 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "16x9 NU";
				} else if (seqName.slice(seqName.length-10,seqName.length) == "1x1 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "16x9 MORGEN";
				} else if (seqName.slice(seqName.length-12,seqName.length) == "1x1 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-12) + "16x9 WOENSDAG";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "1x1 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "16x9 DONDERDAG";
				} else if (seqName.slice(seqName.length-10,seqName.length) == "9x16 DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-10) + "16x9 DATUM";
				} else if (seqName.slice(seqName.length-7,seqName.length) == "9x16 NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-7) + "16x9 NU";
				} else if (seqName.slice(seqName.length-11,seqName.length) == "9x16 MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-11) + "16x9 MORGEN";
				} else if (seqName.slice(seqName.length-13,seqName.length) == "9x16 WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-13) + "16x9 WOENSDAG";
				} else if (seqName.slice(seqName.length-14,seqName.length) == "9x16 DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-14) + "16x9 DONDERDAG";
				} else if (seqName.slice(seqName.length-5,seqName.length) == "DATUM") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-5) + "16x9 DATUM";
				} else if (seqName.slice(seqName.length-2,seqName.length) == "NU") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-2) + "16x9 NU";
				} else if (seqName.slice(seqName.length-6,seqName.length) == "MORGEN") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-6) + "16x9 MORGEN";
				} else if (seqName.slice(seqName.length-8,seqName.length) == "WOENSDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-8) + "16x9 WOENSDAG";
				} else if (seqName.slice(seqName.length-9,seqName.length) == "DONDERDAG") {
					app.project.activeSequence.name = seqName.slice(0,seqName.length-9) + "16x9 DONDERDAG";
				} else {
					app.project.activeSequence.name = seqName + " 16x9";
				}
				seqSettings = app.project.activeSequence.getSettings();
				seqSettings.videoFrameWidth = 1920;
				seqSettings.videoFrameHeight= 1080;
				app.project.activeSequence.setSettings(seqSettings);

			} else {
				$._PPP_.updateEventPanel("No active sequence.");
				alert("Select one or multiple sequences to export.");
			}
		}
	},

	testlijst: function(outputPresetPath) { //Todo: Add check to see if JSON file exists
		app.enableQE();
		//Get project number from project filename
		app.project.exportTimeline("SDK Export Controller");
	},

	importvideo: function() {
		app.enableQE();

		var projPath	= app.project.path;
		var projName = app.project.name;
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		//Check if AE bin exists and otherwise create it
		var nameToFind	= 'Video';
		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		if (!targetBin) {
			targetBin = app.project.rootItem.createBin("Video");
		}

		//Video import
		var importFolder = Folder(projFolder + "Video");
		//File myFiles array with paths of contents of the importFolder
		var myFiles = importFolder.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes = [];
		for (i = 0; i < myFiles.length; i++) {
			for (j = 0; j < targetBin.children.numItems; j++) {
				var imported = encodeURIComponent(targetBin.children[j].name);
				var file = myFiles[i].name;
				if (imported == file) {
					dupes.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes.length -1; i >= 0; i--) {
			myFiles.splice(dupes[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles.length; i++) {
			myFiles[i] = myFiles[i].fsName;
		}

		//import the files in the myFiles array to the targetBin
		app.project.importFiles(myFiles,false,targetBin);
	},

	importae: function() {
		app.enableQE();

		var projPath	= app.project.path;
		var projName = app.project.name;
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		//Check if AE bin exists and otherwise create it
		var nameToFind	= 'AE';
		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		if (!targetBin) {
			targetBin = app.project.rootItem.createBin("AE");
		}

		//16x9 import
		var importFolder = Folder(projFolder + "AE/16x9");
		//Check if 16x9 bin exists in AE bin and otherwise create it
		for (i = 0; i < targetBin.children.numItems; i++) {
			if (targetBin.children[i].name == "16x9"){
				targetBin = targetBin.children[i];
			}
		}
		if (targetBin.name == "AE") {
			targetBin = targetBin.createBin("16x9");
		}
		//File myFiles array with paths of contents of the importFolder
		var myFiles = importFolder.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes = [];
		for (i = 0; i < myFiles.length; i++) {
			for (j = 0; j < targetBin.children.numItems; j++) {
				var imported = encodeURIComponent(targetBin.children[j].name);
				var file = myFiles[i].name;
				if (imported == file) {
					dupes.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes.length -1; i >= 0; i--) {
			myFiles.splice(dupes[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles.length; i++) {
			myFiles[i] = myFiles[i].fsName;
		}

		//1x1 import
		var nameToFind	= 'AE';
		var targetBin2	= $._PPP_.searchForBinWithName(nameToFind);
		var importFolder2 = Folder(projFolder + "AE/1x1");
		//Check if 1x1 bin exists in AE bin and otherwise create it
		for (i = 0; i < targetBin2.children.numItems; i++) {
			if (targetBin2.children[i].name == "1x1"){
				targetBin2 = targetBin2.children[i];
			}
		}
		if (targetBin2.name == "AE") {
			targetBin2 = targetBin2.createBin("1x1");
		}
		//File myFiles array with paths of contents of the importFolder
		var myFiles2 = importFolder2.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes2 = [];
		for (i = 0; i < myFiles2.length; i++) {
			for (j = 0; j < targetBin2.children.numItems; j++) {
				var imported2 = encodeURIComponent(targetBin2.children[j].name);
				var file2 = myFiles2[i].name;
				if (imported2 == file2) {
					dupes2.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes2.length -1; i >= 0; i--) {
			myFiles2.splice(dupes2[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles2.length; i++) {
			myFiles2[i] = myFiles2[i].fsName;
		}

		//9x16 import
		var nameToFind	= 'AE';
		var targetBin3	= $._PPP_.searchForBinWithName(nameToFind);
		var importFolder3 = Folder(projFolder + "AE/9x16");
		//Check if 9x16 bin exists in AE bin and otherwise create it
		for (i = 0; i < targetBin3.children.numItems; i++) {
			if (targetBin3.children[i].name == "9x16"){
				targetBin3 = targetBin3.children[i];
			}
		}
		if (targetBin3.name == "AE") {
			targetBin3 = targetBin3.createBin("9x16");
		}
		//File myFiles array with paths of contents of the importFolder
		var myFiles3 = importFolder3.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes3 = [];
		for (i = 0; i < myFiles3.length; i++) {
			for (j = 0; j < targetBin3.children.numItems; j++) {
				var imported3 = encodeURIComponent(targetBin3.children[j].name);
				var file3 = myFiles3[i].name;
				if (imported3 == file3) {
					dupes3.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes3.length -1; i >= 0; i--) {
			myFiles3.splice(dupes3[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles3.length; i++) {
			myFiles3[i] = myFiles3[i].fsName;
		}

		//Dyn Subs import
		var nameToFind	= 'AE';
		var targetBin4	= $._PPP_.searchForBinWithName(nameToFind);
		var importFolder4 = Folder(projFolder + "AE/Dyn Subs");
		//Check if Dyn Subs bin exists in AE bin and otherwise create it
		for (i = 0; i < targetBin4.children.numItems; i++) {
			if (targetBin4.children[i].name == "Dyn Subs"){
				targetBin4 = targetBin4.children[i];
			}
		}
		if (targetBin4.name == "AE") {
			targetBin4 = targetBin4.createBin("Dyn Subs");
		}
		//File myFiles array with paths of contents of the importFolder
		var myFiles4 = importFolder4.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes4 = [];
		for (i = 0; i < myFiles4.length; i++) {
			for (j = 0; j < targetBin4.children.numItems; j++) {
				var imported4 = encodeURIComponent(targetBin4.children[j].name);
				var file4 = myFiles4[i].name;
				if (imported4 == file4) {
					dupes4.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes4.length -1; i >= 0; i--) {
			myFiles4.splice(dupes4[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles4.length; i++) {
			myFiles4[i] = myFiles4[i].fsName;
		}

		//import the files in the myFiles array to the targetBin
		app.project.importFiles(myFiles,false,targetBin);
		app.project.importFiles(myFiles2,false,targetBin2);
		app.project.importFiles(myFiles3,false,targetBin3);
		app.project.importFiles(myFiles4,false,targetBin4);
	},

	importaudio: function() {
		app.enableQE();

		var projPath	= app.project.path;
		var projName = app.project.name;
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		//Check if AE bin exists and otherwise create it
		var nameToFind	= 'Audio';
		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		if (!targetBin) {
			targetBin = app.project.rootItem.createBin("Audio");
		}

		//Audio import
		var importFolder = Folder(projFolder + "Audio");
		//File myFiles array with paths of contents of the importFolder
		var myFiles = importFolder.getFiles();
		//Check if any files in the myFiles array are already imported and put hose indexes in de dupes array
		var dupes = [];
		for (i = 0; i < myFiles.length; i++) {
			for (j = 0; j < targetBin.children.numItems; j++) {
				var imported = encodeURIComponent(targetBin.children[j].name);
				var file = myFiles[i].name;
				if (imported == file) {
					dupes.push(i);
				}
			}
		}
		//Take already imported files out of the myFiles array using the indexes in de dupes array
		for (i = dupes.length -1; i >= 0; i--) {
			myFiles.splice(dupes[i],1);
		}
		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles.length; i++) {
			myFiles[i] = myFiles[i].fsName;
		}

		//import the files in the myFiles array to the targetBin
		app.project.importFiles(myFiles,false,targetBin);
	},

	importaudiomediapool: function() {
		app.enableQE();

		var projPath	= app.project.path;
		var projName = app.project.name;
		var projNr = projName.slice(0,5);
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		//Audio import
		var importFolder = '';
		var checkFolder = Folder("Volumes/Mediapool/Testklant/");
		var checkFiles = checkFolder.getFiles();
		for (i = 0; i < checkFiles.length; i++) {
			var checkFile = checkFiles[i].fsName;
			if (checkFile.match(projNr)) {
				importFolder = Folder(checkFile + "/Media Audio Wave Export/");
			}
		}
		//File myFiles array with paths of contents of the importFolder
		var myFiles = importFolder.getFiles();
		var myNames = importFolder.getFiles();

		//convert relative paths to platform-specific paths
		for (i = 0; i < myFiles.length; i++) {
			myFiles[i] = myFiles[i].fsName;
			myNames[i] = myNames[i].name;
		}

		//Take out .DS_Store if in the array of files
		for (i = 0; i < myFiles.length; i++) {
			if (myNames[i] == '.DS_Store') {
				myFiles.splice(i,1);
				myNames.splice(i,1);
				break
			}
		}

		//Copy over folder from the mediapoool that are not found in the project folder

		//// Todo -> Copying one file works fine, for a whole folder get the file structure and copy files over 1 by 1 (copy play-outs to mediapool after rendering?)
		for (i = 0)
			myFile = File(projFolder + '/Audio/');
			alert(myFile.name);
			myFile.copy(projFolder + '/Audio2');


		alert(myNames);
	},
	*/

	editlog: function(outputPresetPath) { //Todo: Add check to see if JSON file exists
		app.enableQE();

		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		return projNr;

	},

	openprojectfolder: function(outputPresetPath) { //Todo: Add check to see if JSON file exists
		app.enableQE();

		var projPath	= app.project.path;
		var projName = app.project.name;
		var projFolder = projPath.slice(0,(projPath.length-projName.length));

		return projFolder;

	},

	saveProjectCopy : function() {
		var sessionCounter	= 1;
		var originalPath	= app.project.path;
		var outputPath		= Folder.selectDialog("Choose the output directory");

		if (outputPath) {
			var absPath		= outputPath.fsName;
			var outputName	= String(app.project.name);
			var array		= outputName.split('.', 2);

			outputName = array[0]+ sessionCounter + '.' + array[1];
			sessionCounter++;

			var fullOutPath = absPath + $._PPP_.getSep() + outputName;

			app.project.saveAs(fullOutPath);

			for (var a = 0; a < app.projects.numProjects; a++){
				var currentProject = app.projects[a];
				if (currentProject.path === fullOutPath){
					app.openDocument(originalPath);		// Why first? So we don't frighten the user by making PPro's window disappear. :)
					currentProject.closeDocument();
				}
			}
		} else {
			$._PPP_.updateEventPanel("No output path chosen.");
		}
	},

	mungeXMP : function(){
		var projectItem	= app.project.rootItem.children[0]; // assumes first item is footage.
		if (projectItem) {
			if (ExternalObject.AdobeXMPScript === undefined) {
				ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
			}
			if (ExternalObject.AdobeXMPScript !== undefined) { 	// safety-conscious!

				var xmpBlob					= projectItem.getXMPMetadata();
				var xmp						= new XMPMeta(xmpBlob);
				var oldSceneVal				= "";
				var oldDMCreatorVal 		= "";

				if (xmp.doesPropertyExist(XMPConst.NS_DM, "scene") === true){
					var myScene = xmp.getProperty(XMPConst.NS_DM, "scene");
					oldSceneVal	= myScene.value;
				}

				if (xmp.doesPropertyExist(XMPConst.NS_DM, "creator") === true){
					var myCreator = xmp.getProperty(XMPConst.NS_DM, "creator");
					oldCreatorVal	= myCreator.value;
				}

				// Regardless of whether there WAS scene or creator data, set scene and creator data.

				xmp.setProperty(XMPConst.NS_DM, "scene",	oldSceneVal 	+ " Added by PProPanel sample!");
				xmp.setProperty(XMPConst.NS_DM, "creator",	oldDMCreatorVal + " Added by PProPanel sample!");

				// That was the NS_DM creator; here's the NS_DC creator.

				var creatorProp             = "creator";
				var containsDMCreatorValue  = xmp.doesPropertyExist(XMPConst.NS_DC, creatorProp);
				var numCreatorValuesPresent = xmp.countArrayItems(XMPConst.NS_DC, creatorProp);
				var CreatorsSeparatedBy4PoundSigns = "";

				if(numCreatorValuesPresent > 0) {
					for (var z = 0; z < numCreatorValuesPresent; z++){
						CreatorsSeparatedBy4PoundSigns = CreatorsSeparatedBy4PoundSigns + xmp.getArrayItem(XMPConst.NS_DC, creatorProp, z + 1);
						CreatorsSeparatedBy4PoundSigns = CreatorsSeparatedBy4PoundSigns + "####";
					}
					$._PPP_.updateEventPanel(CreatorsSeparatedBy4PoundSigns);

					if (confirm("Replace previous?", false, "Replace existing Creator?")) {
						xmp.deleteProperty(XMPConst.NS_DC, "creator");
					}
					xmp.appendArrayItem(XMPConst.NS_DC, // If no values exist, appendArrayItem will create a value.
										creatorProp,
										numCreatorValuesPresent + " creator values were already present.",
										null,
										XMPConst.ARRAY_IS_ORDERED);

				} else {

					xmp.appendArrayItem(XMPConst.NS_DC,
										creatorProp,
										"PProPanel wrote the first value into NS_DC creator field.",
										null,
										XMPConst.ARRAY_IS_ORDERED);
				}
				var xmpAsString = xmp.serialize();			// either way, serialize and write XMP.
				projectItem.setXMPMetadata(xmpAsString);
			}
		} else {
			$._PPP_.updateEventPanel("Project item required.");
		}
	},

	getProductionByName : function(nameToGet) {
		var production;
		for (var i = 0; i < productionList.numProductions; i++) {
			var currentProduction = productionList[i];

			if (currentProduction.name == nameToGet) {
				production = currentProduction;
			}
		}
		return production;
	},

	pokeAnywhere : function() {
		var token				= app.anywhere.getAuthenticationToken();
		var productionList		= app.anywhere.listProductions();
		var isProductionOpen	= app.anywhere.isProductionOpen();
		if (isProductionOpen === true) {
			var sessionURL			= app.anywhere.getCurrentEditingSessionURL();
			var selectionURL		= app.anywhere.getCurrentEditingSessionSelectionURL();
			var activeSequenceURL	= app.anywhere.getCurrentEditingSessionActiveSequenceURL();

			var theOneIAskedFor = $._PPP_.getProductionByName("test");

			if (theOneIAskedFor) {
				var out	= theOneIAskedFor.name + ", " + theOneIAskedFor.description;
				$._PPP_.updateEventPanel("Found: " + out);
			}
		} else {
			$._PPP_.updateEventPanel("No Production open.");
		}
	},

	dumpOMF : function() {
		var activeSequence	= app.project.activeSequence;
		if (activeSequence) {
			var outputPath	= Folder.selectDialog("Choose the output directory");
			if (outputPath){
				var absPath				= outputPath.fsName;
				var outputName			= String(activeSequence.name) + '.omf';
				var fullOutPathWithName = absPath + $._PPP_.getSep() + outputName;

				app.project.exportOMF(	app.project.activeSequence,		// sequence
										fullOutPathWithName, 		// output file path
										'OMFTitle',						// OMF title
										48000,							// sample rate (48000 or 96000)
										16,								// bits per sample (16 or 24)
										1,								// audio encapsulated flag (1 : yes or 0 : no)
										0,								// audio file format (0 : AIFF or 1 : WAV)
										0,								// trim audio files (0 : no or 1 : yes)
										0,								// handle frames (if trim is 1, handle frames from 0 to 1000)
										0);								// include pan flag (0 : no or 1 : yes)
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	addClipMarkers : function () {
		if (app.project.rootItem.children.numItems > 0){
			var projectItem	= app.project.rootItem.children[0]; // assumes first item is footage.
			if (projectItem) {
				if (projectItem.type == ProjectItemType.CLIP ||	projectItem.type == ProjectItemType.FILE) {

					markers	= projectItem.getMarkers();

					if (markers) {
						var num_markers		= markers.numMarkers;
						var new_marker		= markers.createMarker(12.345);
						var guid 			= new_marker.guid; // new in 11.1

						new_marker.name		= 'Marker created by PProPanel.';
						new_marker.comments	= 'Here are some comments, inserted by PProPanel.';
						new_marker.end		= 15.6789;

						//default marker type == comment. To change marker type, call one of these:

						// new_marker.setTypeAsChapter();
						// new_marker.setTypeAsWebLink();
						// new_marker.setTypeAsSegmentation();
						// new_marker.setTypeAsComment();
					}
				} else {
					$._PPP_.updateEventPanel("Can only add markers to footage items.");
				}
			} else {
				$._PPP_.updateEventPanel("Could not find first projectItem.");
			}
		} else {
			$._PPP_.updateEventPanel("Project is empty.");
		}
	},

	modifyProjectMetadata : function () {
		var kPProPrivateProjectMetadataURI	= "http://ns.adobe.com/premierePrivateProjectMetaData/1.0/";

		var namefield	= "Column.Intrinsic.Name";
		var tapename	= "Column.Intrinsic.TapeName";
		var desc		= "Column.PropertyText.Description";
		var logNote    	= "Column.Intrinsic.LogNote";
		var newField	= "ExampleFieldName";

		if (app.isDocumentOpen()) {
			var projectItem	= app.project.rootItem.children[0]; // just grabs first projectItem.
			if (projectItem) {
				if (ExternalObject.AdobeXMPScript === undefined) {
					ExternalObject.AdobeXMPScript	= new ExternalObject('lib:AdobeXMPScript');
				}
				if (ExternalObject.AdobeXMPScript !== undefined) {	// safety-conscious!
					var projectMetadata		= projectItem.getProjectMetadata();
					var successfullyAdded	= app.project.addPropertyToProjectMetadataSchema(newField, "ExampleFieldLabel",	2);

					var xmp	= new XMPMeta(projectMetadata);
					var obj	= xmp.dumpObject();

					// var aliases = xmp.dumpAliases();

					var namespaces					= XMPMeta.dumpNamespaces();
					var found_name					= xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, namefield);
					var found_tapename				= xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, tapename);
					var found_desc					= xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, desc);
					var found_custom				= xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, newField);
					var foundLogNote       			= xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, logNote);
					var oldLogValue        			= "";
					var appendThis          		= "This log note inserted by PProPanel.";
					var appendTextWasActuallyNew	= false;

					 if(foundLogNote){
						var oldLogNote = xmp.getProperty(kPProPrivateProjectMetadataURI, logNote);
						if (oldLogNote){
							oldLogValue = oldLogNote.value;
						}
					 }

					xmp.setProperty(kPProPrivateProjectMetadataURI, tapename, 	"***TAPENAME***");
					xmp.setProperty(kPProPrivateProjectMetadataURI, desc, 		"***DESCRIPTION***");
					xmp.setProperty(kPProPrivateProjectMetadataURI, namefield, 	"***NEWNAME***");
					xmp.setProperty(kPProPrivateProjectMetadataURI, newField, 	"PProPanel set this, using addPropertyToProjectMetadataSchema().");


					var array	= [];
					array[0]	= tapename;
					array[1]	= desc;
					array[2]	= namefield;
					array[3]	= newField;

					var concatenatedLogNotes = "";

					if (oldLogValue != appendThis){ 		// if that value is not exactly what we were going to add
						if (oldLogValue.length > 0){		// if we have a valid value
							concatenatedLogNotes += "Previous log notes: " + oldLogValue + "    ||||    ";
						}
						concatenatedLogNotes += appendThis;
						xmp.setProperty(kPProPrivateProjectMetadataURI, logNote, concatenatedLogNotes);
						array[4]    = logNote;
					}

					var str = xmp.serialize();
					projectItem.setProjectMetadata(str, array);

					// test: is it in there?

					var newblob		= projectItem.getProjectMetadata();
					var newXMP		= new XMPMeta(newblob);
					var foundYet	= newXMP.doesPropertyExist(kPProPrivateProjectMetadataURI, newField);

					if (foundYet){
						$._PPP_.updateEventPanel("PProPanel successfully added a field to the project metadata schema, and set a value for it.");
					}
				}
			} else {
				$._PPP_.updateEventPanel("No project items found.");
			}
		}
	},

	updatePAR : function() {
		var item = app.project.rootItem.children[0];
		if (item) {
			if ((item.type == ProjectItemType.FILE) || (item.type == ProjectItemType.CLIP)){
				// If there is an item, and it's either a clip or file...
				item.setOverridePixelAspectRatio(185,  100); // anamorphic is BACK!	  ;)
			} else {
				$._PPP_.updateEventPanel('You cannot override the PAR of bins or sequences.');
			}
		} else {
			$._PPP_.updateEventPanel("No project items found.");
		}
	},

	getnumAEProjectItems : function() {
		var bt		= new BridgeTalk();
		bt.target	= 'aftereffects';
		bt.body		= //'$._PPP_.updateEventPanel("Items in AE project: " + app.project.rootFolder.numItems);app.quit();';
					  'alert("Items in AE project: " + app.project.rootFolder.numItems);app.quit();';
		bt.send();
	},

	updateEventPanel : function(message) {
		//app.setSDKEventMessage(message, 'info');
		//app.setSDKEventMessage('Here is some information.', 'info');
		//app.setSDKEventMessage('Here is a warning.', 'warning');
		//app.setSDKEventMessage('Here is an error.', 'error');  // Very annoying; use sparingly.
	},

	walkAllBinsForFootage : function(parentItem, outPath){
		for (var j = 0; j < parentItem.children.numItems; j++){
			var currentChild	= parentItem.children[j];
			if (currentChild){
				if (currentChild.type == ProjectItemType.BIN){
					$._PPP_.walkAllBinsForFootage(currentChild, outPath);		// warning; recursion!
				} else {
					$._PPP_.dumpProjectItemXMP(currentChild, outPath);
				}
			}
		}
	},

	searchBinForProjItemByName : function(i, containingBin, nameToFind){
		for (var j = i; j < containingBin.children.numItems; j++){
			var currentChild	= containingBin.children[j];
			if (currentChild){
				if (currentChild.type == ProjectItemType.BIN){
					return $._PPP_.searchBinForProjItemByName(j, currentChild, nameToFind);		// warning; recursion!
				} else {
					 if (currentChild.name == nameToFind){
						return currentChild;
					 } else {
						currentChild = currentItem.children[j+1];
						if (currentChild){
							return $._PPP_.searchBinForProjItemByName(0, currentChild, nameToFind);
						}
					}
				}
			}
		}
	},

	dumpProjectItemXMP : function (projectItem, outPath) {
		var xmpBlob				= projectItem.getXMPMetadata();
		var outFileName			= projectItem.name + '.xmp';
		var completeOutputPath	= outPath + $._PPP_.getSep() + outFileName;
		var outFile				= new File(completeOutputPath);

		var isThisASequence		= projectItem.isSequence();

		if (outFile){
			outFile.encoding = "UTF8";
			outFile.open("w", "TEXT", "????");
			outFile.write(xmpBlob.toString());
			outFile.close();
		}
	},

	addSubClip : function() {
		var startTime			= new Time;
		startTime.seconds		= 0.0;
		var endTime				= new Time;
		endTime.seconds			= 3.21;
		var hasHardBoundaries	= 0;
		var sessionCounter		= 1;
		var takeVideo			= 1; // optional, defaults to 1
		var takeAudio			= 1; //	optional, defaults to 1
		var projectItem			= app.project.rootItem.children[0]; // just grabs the first item
		if (projectItem) {
			if ((projectItem.type == ProjectItemType.CLIP)	|| (projectItem.type == ProjectItemType.FILE)) {
				var newSubClipName	= prompt('Name of subclip?',	projectItem.name + '_' + sessionCounter, 'Name your subclip');

				var newSubClip 	= projectItem.createSubClip(newSubClipName,
															startTime,
															endTime,
															hasHardBoundaries,
															takeVideo,
															takeAudio);

				if (newSubClip){
					newSubClip.setStartTime(12.345);
				}
			} else {
				$._PPP_.updateEventPanel("Could not sub-clip " + projectItem.name + ".");
			}
		} else {
			$._PPP_.updateEventPanel("No project item found.");
		}
	},

	dumpXMPFromAllProjectItems : function() {
		var	numItemsInRoot	= app.project.rootItem.children.numItems;
		if (numItemsInRoot > 0) {
			var outPath = Folder.selectDialog("Choose the output directory");
			if (outPath) {
				for (var i = 0; i < numItemsInRoot; i++){
					var currentItem	= app.project.rootItem.children[i];
					if (currentItem){
						if (currentItem.type == ProjectItemType.BIN){
							$._PPP_.walkAllBinsForFootage(currentItem, outPath.fsName);
						} else {
							$._PPP_.dumpProjectItemXMP(currentItem, outPath.fsName);
						}
					}
				}
			}
		} else {
			$._PPP_.updateEventPanel("No project items found.");
		}
	},

	exportAAF : function() {
		var sessionCounter	= 1;
		if (app.project.activeSequence){
			var outputPath	= Folder.selectDialog("Choose the output directory");
			if (outputPath) {
				var absPath			= outputPath.fsName;
				var outputName		= String(app.project.name);
				var array			= outputName.split('.', 2);
				outputName 			= array[0]+ sessionCounter + '.' + array[1];

				sessionCounter++;
				var fullOutPath 	= absPath + $._PPP_.getSep() + outputName + '.aaf';
				//var optionalPathToOutputPreset = null;  New in 11.0.0, you can specify an output preset.

				app.project.exportAAF(	app.project.activeSequence,			// which sequence
										fullOutPath,						// output path
										1,									// mix down video?
										0,									// explode to mono?
										96000,								// sample rate
										16,									// bits per sample
										0,									// embed audio?
										0,									// audio file format? 0 = aiff, 1 = wav
										0,									// trim sources?
										0/*,								// number of 'handle' frames
										optionalPathToOutputPreset*/);		// optional; .epr file to use
			} else {
				$._PPP_.updateEventPanel("Couldn't create AAF output.");
			 }
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	setScratchDisk : function (){
		var scratchPath = Folder.selectDialog("Choose new scratch disk directory");
		if ((scratchPath) && scratchPath.exists) {
			app.setScratchDiskPath(scratchPath.fsName, ScratchDiskType.FirstAutoSaveFolder); // see ScratchDiskType object, in ESTK.
		}
	},

	getProjectProxySetting : function() {
		var returnVal = "";
		if (app.project){
			var returnVal	= "No sequence detected in " + app.project.name + ".";
			if (app.getEnableProxies()) {
				returnVal	= 'true';
			} else {
				returnVal	= 'false';
			}
		} else {
			returnVal = "No project available.";
		}
		return returnVal;
	},

	toggleProxyState : function() {
		var update	= "Proxies for " + app.project.name + " turned ";
		if (app.getEnableProxies()) {
			app.setEnableProxies(0);
			update	= update + "OFF.";
			//app.setSDKEventMessage(update, 'info');
		} else {
			app.setEnableProxies(1);
			update	= update + "ON.";
			//app.setSDKEventMessage(update, 'info');
		}
	},

	setProxiesON : function () {
		var firstProjectItem = app.project.rootItem.children[0];
		if (firstProjectItem) {
			if (firstProjectItem.canProxy()){
				var shouldAttachProxy	= true;
				if (firstProjectItem.hasProxy()) {
					shouldAttachProxy	= confirm(firstProjectItem.name + " already has an assigned proxy. Re-assign anyway?", false, "Are you sure...?");
				}
				if (shouldAttachProxy) {
					var filterString = "";
					if (Folder.fs === 'Windows'){
						filterString = "All files:*.*";
					}
					var proxyPath	= File.openDialog(	"Choose proxy for " + firstProjectItem.name + ":",
														filterString,
														false);
					if (proxyPath.exists){
						firstProjectItem.attachProxy(proxyPath.fsName, 0);
					} else {
						$._PPP_.updateEventPanel("Could not attach proxy from " + proxyPath + ".");
					}
				}
			} else {
				$._PPP_.updateEventPanel("Cannot attach a proxy to " + firstProjectItem.name + ".");
			}
		} else {
			$._PPP_.updateEventPanel("No project item available.");
		}
	},

	clearCache : function () {
		app.enableQE();
		MediaType 	= {};

		// Magical constants from Premiere Pro's internal automation.

		MediaType.VIDEO = "228CDA18-3625-4d2d-951E-348879E4ED93";
		MediaType.AUDIO = "80B8E3D5-6DCA-4195-AEFB-CB5F407AB009";
		MediaType.ANY	= "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF";
		qe.project.deletePreviewFiles(MediaType.ANY);
		$._PPP_.updateEventPanel("All video and audio preview files deleted.");
	},

	randomizeSequenceSelection : function (){
		var sequence			= app.project.activeSequence;

		if (sequence){
			var trackGroups			= [ sequence.audioTracks, sequence.videoTracks ];
			var trackGroupNames		= [ "audioTracks", "videoTracks" ];
			var updateUI			= true;
			var before;

			for(var gi = 0; gi<2; gi++)	{
				$._PPP_.updateEventPanel(trackGroupNames[gi]);
				group	= trackGroups[gi];
				for(var ti=0; ti<group.numTracks; ti++){
					var track		= group[ti];
					var clips		= track.clips;
					var transitions	= track.transitions;
					var beforeSelected;
					var afterSelected;

					$._PPP_.updateEventPanel("track : " + ti + "	 clip count: " + clips.numTracks + "	  transition count: " + transitions.numTracks);

					for(var ci=0; ci<clips.numTracks; ci++){
						var clip	= clips[ci];
						name		= (clip.projectItem === undefined ? "<null>" : clip.projectItem.name);
						before		= clip.isSelected();

						// randomly select clips
						clip.setSelected((Math.random() > 0.5), updateUI);

                         if (clip.isAdjustmentLayer()){ // new in 13.0
                             $._PPP_.updateEventPanel("Clip named \"" + clip.name + "\" is an adjustment layer.");
                         }

						// Note; there's no good place to exercise this code yet, but
						// I wanted to provide example usage.

						var allClipsInThisSequenceFromSameSource = clip.getLinkedItems();

                        if (allClipsInThisSequenceFromSameSource){
						$._PPP_.updateEventPanel("Found " + allClipsInThisSequenceFromSameSource.numItems + " clips from " + clip.projectItem.name + ", in this sequence.");
                        }
						beforeSelected	= before ? "Y" : "N";
						afterSelected	= clip.selected ? "Y" : "N";
						$._PPP_.updateEventPanel("clip : " + ci + "	 " + name + "		" + beforeSelected + " -> " + afterSelected);
					}

					for(var tni=0; tni<transitions.numTracks; ++tni){
						var transition	= transitions[tni];
						before			= transition.isSelected();

						// randomly select transitions
						transition.setSelected((Math.random() > 0.5), updateUI);

						beforeSelected	= before ? "Y" : "N";
						afterSelected	= transition.selected ? "Y" : "N";

						$._PPP_.updateEventPanel('transition: ' + tni + "		" + beforeSelected + " -> " + afterSelected);
					}
				}
			}
		} else {
			$._PPP_.updateEventPanel("no active sequence.");
		}
	},

	// Define a couple of callback functions, for AME to use during render.

	onEncoderJobComplete : function (jobID, outputFilePath) {
		var eoName;

		if (Folder.fs == 'Macintosh') {
			eoName = "PlugPlugExternalObject";
		} else {
			eoName = "PlugPlugExternalObject.dll";
		}

		var suffixAddedByPPro	= '_1'; // You should really test for any suffix.
		var withoutExtension	= outputFilePath.slice(0,-4); // trusting 3 char extension
		var lastIndex			= outputFilePath.lastIndexOf(".");
		var extension			= outputFilePath.substr(lastIndex + 1);

		if (outputFilePath.indexOf(suffixAddedByPPro)){
			$._PPP_.updateEventPanel(" Output filename was changed: the output preset name may have been added, or there may have been an existing file with that name. This would be a good place to deal with such occurrences.");
		}

		var mylib		= new ExternalObject('lib:' + eoName);
		var eventObj	= new CSXSEvent();

		eventObj.type	= "com.adobe.csxs.events.PProPanelRenderEvent";
		eventObj.data	= "Rendered Job " + jobID + ", to " + outputFilePath + ".";

		eventObj.dispatch();
	},

	onEncoderJobCompleteR128 : function (jobID, outputFilePath) {
		var eoName;

		if (Folder.fs == 'Macintosh') {
			eoName = "PlugPlugExternalObject";
		} else {
			eoName = "PlugPlugExternalObject.dll";
		}

		var suffixAddedByPPro	= '_1'; // You should really test for any suffix.
		var withoutExtension	= outputFilePath.slice(0,-4); // trusting 3 char extension
		var lastIndex			= outputFilePath.lastIndexOf(".");
		var extension			= outputFilePath.substr(lastIndex + 1);

		if (outputFilePath.indexOf(suffixAddedByPPro)){
			$._PPP_.updateEventPanel(" Output filename was changed: the output preset name may have been added, or there may have been an existing file with that name. This would be a good place to deal with such occurrences.");
		}

		var mylib		= new ExternalObject('lib:' + eoName);
		//var eventObj	= new CSXSEvent();

		//eventObj.type	= "com.adobe.csxs.events.PProPanelRenderEvent";
		//eventObj.data	= "Rendered Job R128" + jobID + ", to " + outputFilePath + ".";

		//eventObj.dispatch();

		var activeSequence = qe.project.getActiveSequence();	// we use a QE DOM function, to determine the output extension.
		app.project.activeSequence.name = globalSelection[0].name + "_werk";
		projectName = app.project.name; //Get project name
		getBin = app.project.getInsertionBin(); //get parent bin projectItem

		var newSeq = app.project.activeSequence.clone(); //copy sequence
		app.project.activeSequence.name = globalSelection[0].name.slice(0,globalSelection[0].name.length-10) //take off _werk again
		var r128MixdownFile = globalSelection[0].name + "_r128_mixdown.wav" //recreate audio file name for when inserting in sequence
		var targetBin	= getBin;
		globalSelection[0].moveBin(targetBin);

		//Remove audio clips
		var checkAudioTracks = 6;
		for (m=0; m < checkAudioTracks; m++){
			var audioTrack = app.project.activeSequence.audioTracks[m];
			var checkAudioClips = audioTrack.clips.numItems;
			for (n=0; n < checkAudioClips; n++){
				audioClip = audioTrack.clips[0];
				audioClip.remove(true, true);
			}
		}

		//import rendered audio file
		var myFile = [];
		myFile[0] = outputFilePath;
		var nameToFind	= 'R128 Mixdowns';
		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		if (!targetBin) {
			var nameToFind	= 'Audio';
			var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
			targetBin.createBin("R128 Mixdowns");
		}
		var nameToFind	= 'R128 Mixdowns';
		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		app.project.importFiles(myFile,true,targetBin);

		var checkBins = app.project.rootItem.children.numItems;
		var insertFileName

		for (k=0; k < checkBins; k++) {
				myBin = app.project.rootItem.children[k];
				if(myBin.name == "Audio"){
						var checkItems = app.project.rootItem.children[k].children.numItems;
						for (l=0; l < checkItems; l++){
								if(myBin.children[l].name == "R128 Mixdowns"){ //Check if item is a bin
										var subTest = myBin.children[l].children.numItems;
										if (subTest > 0) {
											//Is a bin
											for (n=0; n < subTest; n++){
													var myItem = myBin.children[l].children[n];
													var myItemName = myItem.name;
													if (myItemName == r128MixdownFile) {
															insertFileName = myItem;
													}
											}
										}
								}
						}
				}
		}
		app.project.activeSequence.audioTracks[0].insertClip(insertFileName,0);

		alert("LET OP! Zorg ervoor dat alle levels op 0dB staan in de Audio Track Mixer.");
	},

	onEncoderJobError : function (jobID, errorMessage) {
		var eoName;

		if (Folder.fs === 'Macintosh') {
			eoName	= "PlugPlugExternalObject";
		} else {
			eoName	= "PlugPlugExternalObject.dll";
		}

		var mylib		= new ExternalObject('lib:' + eoName);
		var eventObj	= new CSXSEvent();

		eventObj.type	= "com.adobe.csxs.events.PProPanelRenderEvent";
		eventObj.data	= "Job " + jobID + " failed, due to " + errorMessage + ".";
		eventObj.dispatch();
	},

	onEncoderJobProgress : function (jobID, progress) {
		$._PPP_.updateEventPanel('onEncoderJobProgress called. jobID = ' + jobID + '. progress = ' + progress + '.');
	},

	onEncoderJobQueued : function (jobID) {
		app.encoder.startBatch();
	},

	onEncoderJobCanceled : function (jobID) {
		$._PPP_.updateEventPanel('OnEncoderJobCanceled called. jobID = ' + jobID +  '.');
	},

	onPlayWithKeyframes  : function () {
		var seq = app.project.activeSequence;
		if (seq) {
			var firstVideoTrack	= seq.videoTracks[0];
			if (firstVideoTrack){
				var firstClip	= firstVideoTrack.clips[0];
				if (firstClip){
					var clipComponents	= firstClip.components;
					if (clipComponents){
						for (var i = 0; i < clipComponents.numItems; ++i){
							$._PPP_.updateEventPanel('component ' + i + ' = ' + clipComponents[i].matchName + ' : ' + clipComponents[i].displayName);
						}
						if (clipComponents.numItems > 2){

							// 0 = clip
							// 1 = Opacity
							// N effects, then...
							// Shape layer (new in 12.0)

							var blur	= clipComponents[2]; // Assume Gaussian Blur is the first effect applied to the clip.
							if (blur){
								var blurProps	= blur.properties;
								if (blurProps){
									for( var j = 0; j < blurProps.numItems; ++j){
										$._PPP_.updateEventPanel('param ' + j + ' = ' + blurProps[j].displayName);
									}
									var blurriness	= blurProps[0];
									if (blurriness){
										if (!blurriness.isTimeVarying()){
											blurriness.setTimeVarying(true);
										}
										for(var k = 0; k < 20; ++k){
											updateUI	= (k==9);  		// Decide how often to update PPro's UI
											blurriness.addKey(k);
											var blurVal	= Math.sin(3.14159*i/5)*20+25;
											blurriness.setValueAtKey(k, blurVal, updateUI);
										}
									}
									var repeatEdgePixels	= blurProps[2];
									if (repeatEdgePixels){
										if (!repeatEdgePixels.getValue()){
											updateUI	= true;
											repeatEdgePixels.setValue(true, updateUI);
										}
									}
									// look for keyframe nearest to 4s with 1/10 second tolerance
									var keyFrameTime	= blurriness.findNearestKey(4.0, 0.1);
									if (keyFrameTime !== undefined){
										$._PPP_.updateEventPanel('Found keyframe = ' + keyFrameTime.seconds);
									} else {
										$._PPP_.updateEventPanel('Keyframe not found.');
									}

									// scan keyframes, forward

									keyFrameTime	= blurriness.findNearestKey(0.0, 0.1);
									var lastKeyFrameTime	= keyFrameTime;
									while(keyFrameTime !== undefined){
										$._PPP_.updateEventPanel('keyframe @ ' + keyFrameTime.seconds);
										lastKeyFrameTime	= keyFrameTime;
										keyFrameTime		= blurriness.findNextKey(keyFrameTime);
									}

									// scan keyframes, backward
									keyFrameTime	= lastKeyFrameTime;
									while(keyFrameTime	!== undefined){
										$._PPP_.updateEventPanel('keyframe @ ' + keyFrameTime.seconds);
										lastKeyFrameTime	= keyFrameTime;
										keyFrameTime		= blurriness.findPreviousKey(keyFrameTime);
									}

									// get all keyframes

									var blurKeyframesArray	= blurriness.getKeys();
									if (blurKeyframesArray){
										$._PPP_.updateEventPanel(blurKeyframesArray.length + ' keyframes found');
									}

									// remove keyframe at 19s
									blurriness.removeKey(19);

									// remove keyframes in range from 0s to 5s
									var shouldUpdateUI	= true;
									blurriness.removeKeyRange(0,5, shouldUpdateUI);
								}

						} else {
								$._PPP_.updateEventPanel("Please apply the Gaussian Blur effect to the first clip in the first video track of the active sequence.");
					}
						}
					}
				}
			}
		} else {
			$._PPP_.updateEventPanel("no active sequence.");
		}
	},

	extractFileNameFromPath : function (fullPath){
		var lastDot	= fullPath.lastIndexOf(".");
		var lastSep	= fullPath.lastIndexOf("/");

		if (lastDot > -1){
			return fullPath.substr( (lastSep +1), (fullPath.length - (lastDot + 1)));
		} else {
			return fullPath;
		}
	},

	onProxyTranscodeJobComplete : function (jobID, outputFilePath) {
		var suffixAddedByPPro	= '_1'; // You should really test for any suffix.
		var withoutExtension	= outputFilePath.slice(0,-4); // trusting 3 char extension
		var lastIndex			= outputFilePath.lastIndexOf(".");
		var extension			= outputFilePath.substr(lastIndex + 1);

		var wrapper		= [];
		wrapper[0]		= outputFilePath;

		var nameToFind	= 'Proxies generated by PProPanel';
		var targetBin	= $._PPP_.getPPPInsertionBin();
		if (targetBin){
			app.project.importFiles(wrapper);
		}
	},

	onProxyTranscodeJobError : function  (jobID, errorMessage) {
			$._PPP_.updateEventPanel(errorMessage);
	},

	onProxyTranscodeJobQueued : function (jobID) {
		 app.encoder.startBatch();
	},

	ingestFiles : function(outputPresetPath) {
		app.encoder.bind('onEncoderJobComplete',	$._PPP_.onProxyTranscodeJobComplete);
		app.encoder.bind('onEncoderJobError',		$._PPP_.onProxyTranscodeJobError);
		app.encoder.bind('onEncoderJobQueued',		$._PPP_.onProxyTranscodeJobQueued);
		app.encoder.bind('onEncoderJobCanceled',	$._PPP_.onEncoderJobCanceled);

		if (app.project) {
			var filterString = "";
			if (Folder.fs === 'Windows'){
				filterString = "All files:*.*";
			}
			var fileOrFilesToImport	= File.openDialog(	"Choose full resolution files to import", 	// title
														filterString, 								// filter available files?
														true); 										// allow multiple?
			if (fileOrFilesToImport) {
				var nameToFind	= 'Proxies generated by PProPanel';
				var targetBin	= $._PPP_.searchForBinWithName(nameToFind);
				if (targetBin === 0) {
					// If panel can't find the target bin, it creates it.
					app.project.rootItem.createBin(nameToFind);
					targetBin = $._PPP_.searchForBinWithName(nameToFind);
				}
				if (targetBin){
					targetBin.select();
					var importThese = []; // We have an array of File objects; importFiles() takes an array of paths.
					if (importThese){
						for (var i = 0; i < fileOrFilesToImport.length; i++) {
							importThese[i]			= fileOrFilesToImport[i].fsName;
							var justFileName		= extractFileNameFromPath(importThese[i]);
							var suffix				= '_PROXY.mp4';
							var containingPath		= fileOrFilesToImport[i].parent.fsName;
							var completeProxyPath	= containingPath + $._PPP_.getSep() + justFileName + suffix;

							var jobID				=	app.encoder.encodeFile(fileOrFilesToImport[i].fsName,
														completeProxyPath,
														outputPresetPath,
														0);
						}

						app.project.importFiles(importThese,
												1,				// suppress warnings
												targetBin,
												0);				// import as numbered stills
					}
				} else {
					$._PPP_.updateEventPanel("Could not find or create target bin.");
				}
			} else {
				$._PPP_.updateEventPanel("No files to import.");
			}
		} else {
			$._PPP_.updateEventPanel("No project found.");
		}
	},

	insertOrAppend : function() {
		var seq = app.project.activeSequence;
		if (seq){
			var first = app.project.rootItem.children[0];
			if (first){
				 var numVTracks = seq.videoTracks.numTracks;
				 var targetVTrack = seq.videoTracks[(numVTracks - 1)];
				if (targetVTrack){
					// If there are already clips in this track,
					// append this one to the end. Otherwise,
					// insert at start time.

					if (targetVTrack.clips.numItems > 0){
						var lastClip = targetVTrack.clips[(targetVTrack.clips.numItems - 1)];
						if (lastClip){
							targetVTrack.insertClip(first, lastClip.end.seconds);
						}
					}else {
							targetVTrack.insertClip(first, '00;00;00;00');
					}
				} else {
					$._PPP_.updateEventPanel("Could not find first video track.");
				}
			} else {
				$._PPP_.updateEventPanel("Couldn't locate first projectItem.");
			}
		} else {
			$._PPP_.updateEventPanel("no active sequence.");
		}
	},

	overWrite : function() {
		var seq = app.project.activeSequence;
		if (seq){
			var first = app.project.rootItem.children[0];
			if (first) {
				var vTrack1 = seq.videoTracks[0];
				if (vTrack1){
					var now = seq.getPlayerPosition();
					vTrack1.overwriteClip(first, now.seconds);
				} else {
					$._PPP_.updateEventPanel("Could not find first video track.");
				}
			} else {
				$._PPP_.updateEventPanel("Couldn't locate first projectItem.");
			}
		} else {
			$._PPP_.updateEventPanel("no active sequence.");
		}
	},

	closeFrontSourceClip : function() {
		app.sourceMonitor.closeClip();
	},

	closeAllClipsInSourceMonitor : function() {
		app.sourceMonitor.closeAllClips();
	},

	changeLabel : function () {
		var first = app.project.rootItem.children[0];
		if (first){
			var currentLabel = first.getColorLabel();
			var newLabel 	 = currentLabel + 1;  // 4 = Cerulean. 0 = Violet, 15 = Yellow.
			if (newLabel > 15){
				newLabel = newLabel - 16;
			}
			//app.setSDKEventMessage("Previous Label color = " + currentLabel + ".", 'info');
			first.setColorLabel(newLabel);
			//app.setSDKEventMessage("New Label color = " + newLabel + ".", 'info');
		} else {
			$._PPP_.updateEventPanel("Couldn't locate first projectItem.");
		}
	},

	getPPPInsertionBin : function () {
		var nameToFind = "Here's where PProPanel puts things.";

		var targetBin	= $._PPP_.searchForBinWithName(nameToFind);

		if (targetBin === undefined) {
			// If panel can't find the target bin, it creates it.
			app.project.rootItem.createBin(nameToFind);
			targetBin	= $._PPP_.searchForBinWithName(nameToFind);
		}
		if (targetBin) {
			targetBin.select();
			return targetBin;
		}
	},

	importComps : function () {
		var targetBin = $._PPP_.getPPPInsertionBin();
		if (targetBin){
			var filterString = "";
			if (Folder.fs === 'Windows'){
				filterString = "All files:*.*";
			}
            compNamesToImport = [];

			var aepToImport	= 	File.openDialog (	"Choose After Effects project", 	// title
													filterString,						// filter available files?
													false);								// allow multiple?
			if (aepToImport) {
				var importAll 	=	confirm("Import all compositions in project?", false, "Import all?");
				if (importAll){
					var result 	= 	app.project.importAllAEComps(aepToImport.fsName, targetBin);
				} else {
					var compName = 	prompt(	'Name of composition to import?',
											'',
											'Which Comp to import');
					if (compName){
                        compNamesToImport[0] = compName;
                        var importAECompResult = app.project.importAEComps(aepToImport.fsName, compNamesToImport, targetBin);
					} else {
						$._PPP_.updateEventPanel("Could not find Composition.");
					}
				}
			} else {
				$._PPP_.updateEventPanel("Could not open project.");
			}
		} else {
			$._PPP_.updateEventPanel("Could not find or create target bin.");
		}
	},

	consolidateProject : function () {
		var pmo = app.projectManager.options;

		if (app.project.sequences.length){
		if (pmo) {
			var filterString = "";
			if (Folder.fs === 'Windows'){
				filterString = "Output Presets:*.epr";
			}

			var outFolder			= Folder.selectDialog("Choose output directory.");
			if (outFolder) {

				var presetPath 			= "";
				var useSpecificPreset	= confirm("Would you like to select an output preset?", false, "Are you sure...?");
				if (useSpecificPreset){
					var useThisEPR	= File.openDialog (	"Choose output preset (.epr file)", 	// title
														filterString, 							// filter available files?
														false); 								// allow multiple?

					if (useThisEPR){
						pmo.clipTranscoderOption = pmo.CLIP_TRANSCODE_MATCH_PRESET;
						pmo.encoderPresetFilePath 		=	useThisEPR.fsName;
					}
				} else {
					pmo.clipTranscoderOption = pmo.CLIP_TRANSCODE_MATCH_SEQUENCE;
				}

				var processAllSequences	= confirm("Process all sequences? No = just the first sequence found.", true, "Process all?");

				if (processAllSequences){
					pmo.includeAllSequences = true;
				} else {
					pmo.includeAllSequences = false;
					pmo.affectedSequences 	= [app.project.sequences[0]];
				}

				pmo.clipTransferOption 			= 	pmo.CLIP_TRANSFER_TRANSCODE;
				pmo.convertAECompsToClips		=	false;
				pmo.convertSyntheticsToClips 	=	false;
				pmo.copyToPreventAlphaLoss 		=	false;
				pmo.destinationPath 			=	outFolder.fsName;
				pmo.excludeUnused 				=	false;
				pmo.handleFrameCount 			=	0;
				pmo.includeConformedAudio		=	true;
				pmo.includePreviews 			=	true;
				pmo.renameMedia					=	false;

				var result		= app.projectManager.process(app.project);
				var errorList 	= app.projectManager.errors;

				if(errorList.length){
					for (var k = 0; k < errorList.length; k++){
						$._PPP_.updateEventPanel(errorList[k][1]);
					}
				} else {
					$._PPP_.updateEventPanel(app.project.name + " successfully processed to " + outFolder.fsName + ".");
				}
				return result;
			}
		}


		}
		if (pmo) {
			var filterString = "";
			if (Folder.fs === 'Windows'){
				filterString = "Output Presets:*.epr";
			}

			var outFolder			= Folder.selectDialog("Choose output directory.");
			if (outFolder) {

				var presetPath 			= "";
				var useSpecificPreset	= confirm("Would you like to select an output preset?", false, "Are you sure...?");
				if (useSpecificPreset){
					var useThisEPR	= File.openDialog (	"Choose output preset (.epr file)", 	// title
														filterString, 							// filter available files?
														false); 								// allow multiple?

					if (useThisEPR){
						pmo.clipTranscoderOption = pmo.CLIP_TRANSCODE_MATCH_PRESET;
						pmo.encoderPresetFilePath 		=	useThisEPR.fsName;
					}
				} else {
					pmo.clipTranscoderOption = pmo.CLIP_TRANSCODE_MATCH_SEQUENCE;
				}

				var processAllSequences	= confirm("Process all sequences? No = just the first sequence found.", true, "Process all?");

				if (processAllSequences){
					pmo.includeAllSequences = true;
				} else {
					pmo.includeAllSequences = false;
					pmo.affectedSequences 	= [app.project.sequences[0]];
				}

				pmo.clipTransferOption 			= 	pmo.CLIP_TRANSFER_TRANSCODE;
				pmo.convertAECompsToClips		=	false;
				pmo.convertSyntheticsToClips 	=	false;
				pmo.copyToPreventAlphaLoss 		=	false;
				pmo.destinationPath 			=	outFolder.fsName;
				pmo.excludeUnused 				=	false;
				pmo.handleFrameCount 			=	0;
				pmo.includeConformedAudio		=	true;
				pmo.includePreviews 			=	true;
				pmo.renameMedia					=	false;

				var result		= app.projectManager.process(app.project);
				var errorList 	= app.projectManager.errors;

				if(errorList.length){
					for (var k = 0; k < errorList.length; k++){
						$._PPP_.updateEventPanel(errorList[k][1]);
					}
				} else {
					$._PPP_.updateEventPanel(app.project.name + " successfully processed to " + outFolder.fsName + ".");
				}
				return result;
			}
		}
	},

	importMoGRT : function () {
		var activeSeq = app.project.activeSequence;
		if (activeSeq) {
			var filterString = "";
			if (Folder.fs === 'Windows'){
				filterString = "Motion Graphics Templates:*.mogrt";
			}
			var mogrtToImport	= 	File.openDialog (  "Choose MoGRT", 	// title
														filterString,	// filter available files?
														false);			// allow multiple?
			if (mogrtToImport){
				var targetTime		= activeSeq.getPlayerPosition();
				var vidTrackOffset  = 0;
				var audTrackOffset	= 0;
				var newTrackItem 	= activeSeq.importMGT(	mogrtToImport.fsName,
															targetTime.ticks,
															vidTrackOffset,
															audTrackOffset);
				if (newTrackItem){
					var moComp = newTrackItem.getMGTComponent();
					if (moComp){
						var params			= 	moComp.properties;
						for (var z = 0; z < params.numItems; z++){
						   var thisParam = params[0];
						}
						var srcTextParam	=	params.getParamForDisplayName("Main Title");
						if (srcTextParam){
							var val	= srcTextParam.getValue();
							srcTextParam.setValue("New value set by PProPanel!");
						}
					}
				}
			} else {
				//app.setSDKEventMessage('Unable to import ' + mogrtToImport.fsName + '.', 'error');
			}
		} else {
			//app.setSDKEventMessage('No active sequence.');
		}
	},

	reportCurrentProjectSelection : function() {
		var viewIDs = app.getProjectViewIDs(); // sample code optimized for a single open project
		viewSelection = app.getProjectViewSelection(viewIDs[0]);
		$._PPP_.projectPanelSelectionChanged(viewSelection, viewIDs[0]);
	},

	randomizeProjectSelection : function() {
		var viewIDs 					= app.getProjectViewIDs();
		var firstProject 				= app.getProjectFromViewID(viewIDs[0]);
		var arrayOfRandomProjectItems 	= [];

		for (var b = 0; b < app.project.rootItem.children.numItems; b++){
			var currentProjectItem = app.project.rootItem.children[b];
			if (Math.random() > 0.5){
				arrayOfRandomProjectItems.push(currentProjectItem);
			}
		}
		if (arrayOfRandomProjectItems.length > 0){
			app.setProjectViewSelection(arrayOfRandomProjectItems, viewIDs[0]);
		}
	},

	setAllProjectItemsOnline : function(startingBin){
		for (var k = 0; k < startingBin.children.numItems; k++){
			var currentChild = startingBin.children[k];
			if (currentChild){
				if (currentChild.type === ProjectItemType.BIN){
					$._PPP_.setAllProjectItemsOnline(currentChild);		// warning; recursion!
				} else if (currentChild.isOffline()){
					currentChild.changeMediaPath(currentChild.getMediaPath(), true);
                    if (currentChild.isOffline()){
                         $._PPP_.updateEventPanel("Failed to bring \'" + currentChild.name + "\' online.");
                    } else {
                         $._PPP_.updateEventPanel("\'" + currentChild.name + "\' is once again online.");
                    }
				}
			}
		}
	},

	setAllOnline : function(){
		var startingBin = app.project.rootItem;
		$._PPP_.setAllProjectItemsOnline(startingBin);
	},

	setOffline : function() {
		var viewIDs = app.getProjectViewIDs();
        for (var a = 0; a < app.projects.numProjects; a++){
            var currentProject = app.getProjectFromViewID(viewIDs[a]);
            if (currentProject){
                if (currentProject.documentID === app.project.documentID){	// We're in the right project!
                    var selectedItems = app.getProjectViewSelection(viewIDs[a]);
                    for (var b = 0; b < selectedItems.length; b++){
                        var currentItem = selectedItems[b];
                        if (currentItem){
                            if ((!currentItem.isSequence()) && (currentItem.type !== ProjectItemType.BIN)){ // For every selected item which isn't a bin or sequence...
                                if (currentItem.isOffline()){
									$._PPP_.updateEventPanel("\'" + currentItem.name + "\'was already offline.");
								} else {
									var result = currentItem.setOffline();
									$._PPP_.updateEventPanel("\'" + currentItem.name + "\' is now offline.");
								}
                            }
                        }
                    }
                }
            }
        }
	},

	updateFrameRate : function() {
		var item = app.project.rootItem.children[0];
		if (item) {
			if ((item.type == ProjectItemType.FILE) || (item.type == ProjectItemType.CLIP)){
				// If there is an item, and it's either a clip or file...
				item.setOverrideFrameRate(23.976);
			} else {
				$._PPP_.updateEventPanel('You cannot override the frame rate of bins or sequences.');
			}
		} else {
			$._PPP_.updateEventPanel("No project items found.");
		}
	},

	onItemAddedToProject : function(whichProject, addedProjectItem) {
		var msg = addedProjectItem.name + " was added to " + whichProject + "."
		$._PPP_.updateEventPanel(msg);
	},

	registerItemAddedFxn : function() {
		app.onItemAddedToProjectSuccess = $._PPP_.onItemAddedToProject;
	},

	myOnProjectChanged : function(documentID){
		var msg = 'Project with ID ' + documentID + ' Changed.';
		// Commented out, as this happens a LOT.
		// $._PPP_.updateEventPanel(msg);
	},

	registerProjectChangedFxn : function() {
		app.bind('onProjectChanged', $._PPP_.myOnProjectChanged);
	},

	confirmPProHostVersion : function() {
		var version = parseFloat(app.version);
		if (version < 12.1){
			$._PPP_.updateEventPanel("Note: PProPanel relies on features added in 12.1, but is currently running in " + version + ".");
		}
	},

	changeMarkerColors : function() {
		if (app.project.rootItem.children.numItems > 0){
			var projectItem	= app.project.rootItem.children[0]; // assumes first item is footage.
			if (projectItem) {
				if (projectItem.type == ProjectItemType.CLIP ||
					projectItem.type == ProjectItemType.FILE) {

					markers	= projectItem.getMarkers();

					if (markers) {
						var markerCount		= markers.numMarkers;

						if (markerCount){
							for(var thisMarker	=	markers.getFirstMarker(); thisMarker	!==	undefined; 	thisMarker	=	markers.getNextMarker(thisMarker)){
								var oldColor = thisMarker.getColorByIndex();
								var newColor = oldColor + 1;
								if (newColor > 7){
									newColor = 0;
								}
								thisMarker.setColorByIndex(newColor);
								$._PPP_.updateEventPanel("Changed color of marker named \'" + thisMarker.name + "\' from " + oldColor + " to " + newColor + ".");
							}
						}
					}
				} else {
					$._PPP_.updateEventPanel("Can only add markers to footage items.");
				}
			} else {
				$._PPP_.updateEventPanel("Could not find first projectItem.");
			}
		} else {
			$._PPP_.updateEventPanel("Project is empty.");
		}
	},

	changeSeqTimeCodeDisplay : function() {
		if (app.project.activeSequence){
			var currentSeqSettings = app.project.activeSequence.getSettings();
			if (currentSeqSettings){
				var oldVidSetting = currentSeqSettings.videoDisplayFormat;
				currentSeqSettings.videoDisplayFormat = oldVidSetting + 1;
				if (currentSeqSettings.videoDisplayFormat > TIMEDISPLAY_48Timecode){
					currentSeqSettings.videoDisplayFormat = TIMEDISPLAY_24Timecode;
				}
				app.project.activeSequence.setSettings(currentSeqSettings);
				$._PPP_.updateEventPanel("Changed timecode display format for \'" + app.project.activeSequence.name + "\'.");
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	myActiveSequenceChangedFxn : function() {
		$._PPP_.updateEventPanel("Active sequence is now " + app.project.activeSequence.name + ".");
	},

	myActiveSequenceSelectionChangedFxn : function() {
		var sel = app.project.activeSequence.getSelection();
		$._PPP_.updateEventPanel('Current active sequence = ' + app.project.activeSequence.name + '.');
		$._PPP_.updateEventPanel( sel.length + ' track items selected.');
		for(var i = 0; i < sel.length; i++){
			if (sel[i].name !== 'anonymous'){
				$._PPP_.updateEventPanel('Selected item ' + (i+1) + ' == ' + sel[i].name + '.');
			}
		}
	},

	registerActiveSequenceChangedFxn : function() {
		var success = app.bind("onActiveSequenceChanged", $._PPP_.myActiveSequenceChangedFxn);
	},

	registerSequenceSelectionChangedFxn : function() {
		var success = app.bind('onActiveSequenceSelectionChanged', $._PPP_.myActiveSequenceSelectionChangedFxn);
	},

	enableNewWorldScripting : function(){
		app.enableQE();

		var previousNWValue = qe.getDebugDatabaseEntry("ScriptLayerPPro.EnableNewWorld");
		var previousInternalDOMValue = qe.getDebugDatabaseEntry("dvascripting.EnabledInternalDOM");
		if ((previousNWValue === 'true') && (previousInternalDOMValue === 'true')){
			qe.setDebugDatabaseEntry("ScriptLayerPPro.EnableNewWorld", "false");
			qe.setDebugDatabaseEntry("dvascripting.EnabledInternalDOM", "false");
			$._PPP_.updateEventPanel("ScriptLayerPPro.EnableNewWorld and dvascripting.EnabledInternalDOM are now OFF.");
		} else {
			qe.setDebugDatabaseEntry("ScriptLayerPPro.EnableNewWorld", "true");
			qe.setDebugDatabaseEntry("dvascripting.EnabledInternalDOM", "true");
			$._PPP_.updateEventPanel("ScriptLayerPPro.EnableNewWorld and dvascripting.EnabledInternalDOM are now ON.");
		}
	},

	insertOrAppendToTopTracks : function() {
		var seq = app.project.activeSequence;
		if (seq){
			var first = app.project.rootItem.children[0];
			if (first){
                var time = seq.getPlayerPosition();
                var newClip = seq.insertClip(first, time, (seq.videoTracks.numTracks - 1), (seq.audioTracks.numTracks - 1));
                if (newClip){
                    $._PPP_.updateEventPanel("Inserted " + newClip.name + ", into " + seq.name + ".");
                }
			} else {
				$._PPP_.updateEventPanel("Couldn't locate first projectItem.");
			}
		} else {
			$._PPP_.updateEventPanel("no active sequence.");
		}
	},

	closeAllProjectsOtherThanActiveProject : function() {
		var viewIDs = app.getProjectViewIDs();
		var closeTheseProjects = [];
		for (var a = 0; a < viewIDs.length; a++){
			var thisProj = app.getProjectFromViewID(viewIDs[a]);
			if (thisProj.documentID !== app.project.documentID){
				closeTheseProjects[a] = thisProj;
			}
		}
		// Why do this afterward? Because if we close projects in that loop, we change the active project. :)
		for (var b = 0; b < closeTheseProjects.length; b++){
			$._PPP_.updateEventPanel("Closed " + closeTheseProjects[b].name);
			closeTheseProjects[b].closeDocument();
		}
	},

	countAdjustmentLayersInBin : function(parentItem, arrayOfAdjustmentLayerNames, foundSoFar){
		for (var j = 0; j < parentItem.children.numItems; j++){
			var currentChild	= parentItem.children[j];
			if (currentChild){
				if (currentChild.type == ProjectItemType.BIN){
					$._PPP_.countAdjustmentLayersInBin(currentChild, arrayOfAdjustmentLayerNames, foundSoFar);		// warning; recursion!
				} else {
					if (currentChild.isAdjustmentLayer()){
                        arrayOfAdjustmentLayerNames[foundSoFar] = currentChild.name;
                        foundSoFar++;
					}
				}
			}
		}
	},

	findAllAdjustmentLayersInProject : function() {
		var arrayOfAdjustmentLayerNames = [];
		var foundSoFar 					= 0;
		var startingBin 				= app.project.rootItem;

		$._PPP_.countAdjustmentLayersInBin(startingBin, arrayOfAdjustmentLayerNames, foundSoFar);
		if (arrayOfAdjustmentLayerNames.length){
			var remainingArgs 	= arrayOfAdjustmentLayerNames.length;
			var message 		= remainingArgs + " adjustment layers found: ";

			for (var i = 0; i < arrayOfAdjustmentLayerNames.length; i++) {
				message += arrayOfAdjustmentLayerNames[i];
				remainingArgs--;
				if (remainingArgs > 1) {
					message += ', ';
				}
				if (remainingArgs === 1){
					message += ", and ";
				}
				if (remainingArgs === 0) {
					message += ".";
				}
			}
			$._PPP_.updateEventPanel(message);
		} else {
			$._PPP_.updateEventPanel("No adjustment layers found in " + app.project.name + ".");
		}
	},

	consolidateDuplicates : function() {
		result = app.project.consolidateDuplicates();
		$._PPP_.updateEventPanel("Duplicates consolidated in " + app.project.name + ".");
	},

	closeAllSequences : function() {
		var seqList = app.project.sequences;
		for (var a = 0; a < seqList.numSequences; a++){
			var currentSeq = seqList[a];
			if (currentSeq){
				currentSeq.close();
			} else {
				$._PPP_.updateEventPanel("No sequences from " + app.project.name + " were open.");
			}
		}
	},

	dumpAllPresets : function() {
		var desktopPath			= new File("~/Desktop");
		var outputFileName		= desktopPath.fsName + $._PPP_.getSep() + 'available_presets.txt';
		var selectedPreset 		= undefined;
		var selectedExporter 	= undefined;
		var exporters 			= app.encoder.getExporters();

		var outFile = new File(outputFileName);

		outFile.encoding = "UTF8";
		outFile.open("w", "TEXT", "????");

		for(var i = 0; i < exporters.length; i++){
			var exporter = exporters[i];
			if (exporter){
				outFile.writeln('-----------------------------------------------');
				outFile.writeln(i + ':' + exporter.name + ' : ' + exporter.classID + ' : ' + exporter.fileType);
				var presets = exporter.getPresets();
				if (presets){
					outFile.writeln(presets.length + ' presets found');
					for(var j = 0; j < presets.length; j++){
						var preset = presets[j];
						if (preset){
							outFile.writeln('matchName: ' + preset.matchName + '(' + preset.name+')');
							if (preset.name.indexOf('TQM') > -1){
								selectedPreset 		= preset;
								selectedExporter 	= exporter;
								outFile.writeln('selected preset = ' + selectedExporter.name + ' : ' + selectedPreset.name);
								selectedPreset.writeToFile(desktopPath.fsName + $._PPP_.getSep() + preset.name + ".epr");
								$._PPP_.updateEventPanel("List of available presets saved to desktop as \'available_presets.txt\'");
							}
						}
					}
				}
			}
		}
		desktopPath.close();
		outFile.close();
    },

	reportSequenceVRSettings : function() {
		var seq = app.project.activeSequence;
		if (seq){
			var settings = seq.getSettings();
			if (settings){
				$._PPP_.updateEventPanel("====================================================");
				$._PPP_.updateEventPanel("VR Settings for \'" + seq.name + "\':");
				$._PPP_.updateEventPanel("");
				$._PPP_.updateEventPanel("          Horizontal captured view: " + settings.vrHorzCapturedView);
				$._PPP_.updateEventPanel("          Vertical captured view: " + settings.vrVertCapturedView);
				$._PPP_.updateEventPanel("          Layout: " + settings.Layout);
				$._PPP_.updateEventPanel("          Projection: " + settings.vrProjection);
				$._PPP_.updateEventPanel("");
				$._PPP_.updateEventPanel("====================================================");
			}
		}
	},

	openProjectItemInSource : function() {
		var viewIDs = app.getProjectViewIDs();
		if (viewIDs){
			for (var a = 0; a < app.projects.numProjects; a++){
				var currentProject = app.getProjectFromViewID(viewIDs[a]);
				if (currentProject){
					if (currentProject.documentID === app.project.documentID){	// We're in the right project!
						var selectedItems = app.getProjectViewSelection(viewIDs[a]);
						for (var b = 0; b < selectedItems.length; b++){
							var currentItem = selectedItems[b];
							if (currentItem){
								if (currentItem.type !== ProjectItemType.BIN){ // For every selected item which isn't a bin or sequence...
									app.sourceMonitor.openProjectItem(currentItem);
								}
							} else {
								$._PPP_.updateEventPanel("No item available.");
							}
						}
					}
				} else {
					$._PPP_.updateEventPanel("No project available.");
				}
			}
		} else {
			$._PPP_.updateEventPanel("No view IDs available.");
		}
	},

	reinterpretFootage : function() {
		var viewIDs = app.getProjectViewIDs();
		if (viewIDs){
			for (var a = 0; a < app.projects.numProjects; a++){
				var currentProject = app.getProjectFromViewID(viewIDs[a]);
				if (currentProject){
					if (currentProject.documentID === app.project.documentID){	// We're in the right project!
						var selectedItems = app.getProjectViewSelection(viewIDs[a]);
						if (selectedItems){
							for (var b = 0; b < selectedItems.length; b++){
								var currentItem = selectedItems[b];
								if (currentItem){
									if ((currentItem.type !== ProjectItemType.BIN) &&
										(currentItem.isSequence() === false)){
										var interp = currentItem.getFootageInterpretation();
										if (interp) {
											// Note: I made this something terrible, so the change is apparent.
											interp.frameRate = 17.868;
											interp.pixelAspectRatio = 1.2121;
											currentItem.setFootageInterpretation(interp);
										} else {
											$._PPP_.updateEventPanel("Unable to get interpretation for " + currentItem.name + ".");
										}
										var mapping = currentItem.getAudioChannelMapping;
										if (mapping){
											mapping.audioChannelsType = AUDIOCHANNELTYPE_Stereo;
											mapping.audioClipsNumber = 1;
											mapping.setMappingForChannel(0, 4); // 1st param = channel index, 2nd param = source index
											mapping.setMappingForChannel(1, 5);
											currentItem.setAudioChannelMapping(mapping); // submit changed mapping object
										}
									}
								} else {
									$._PPP_.updateEventPanel("No project item available.");
								}
							}
						} else {
							$._PPP_.updateEventPanel("No items selected.");
						}
					}
				} else {
					$._PPP_.updateEventPanel("No project available.");
				}
			}
		} else {
			$._PPP_.updateEventPanel("No view IDs available.");
		}
	},

	createSubSequence : function() {

		/* 	Behavioral Note

			createSubSequence() uses track targeting to select clips when there is
			no current clip selection, in the sequence. To create a subsequence with
			clips on tracks that are currently NOT targeted, either select some clips
			(on any track), or temporarily target all desired tracks.

		*/

		var activeSequence = app.project.activeSequence;
		if (activeSequence) {
			var foundTarget = false;
			for (var a = 0; (a < activeSequence.videoTracks.numTracks) && (foundTarget === false); a++){
				var vTrack = activeSequence.videoTracks[a];
				if (vTrack){
					if (vTrack.isTargeted()){
						foundTarget = true;
					}
				}
			}
			// If no targeted track was found, just target the zero-th track, for demo purposes
			if (foundTarget === false){
				activeSequence.videotracks[0].setTargeted(true, true);
			}

			var cloneAnyway = true;
			if ((activeSequence.getInPoint() == NOT_SET) && (activeSequence.getOutPoint() == NOT_SET)){
				cloneAnyway = confirm("No in or out points set; clone entire sequence?", false, "Clone the whole thing?");
			}
			if (cloneAnyway){
				var ignoreMapping = confirm("Ignore track mapping?", false, "Ignore track mapping?");
				var newSeq = activeSequence.createSubsequence(ignoreMapping);
				// rename newSeq here, as desired.
			}
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	selectAllRetimedClips : function() {
		var activeSeq = app.project.activeSequence;
		var numRetimedClips = 0;
		if (activeSeq){
			var trackGroups			= [ activeSeq.audioTracks, activeSeq.videoTracks ];
			var trackGroupNames		= [ "audioTracks", "videoTracks" ];
			var updateUI			= true;

			for(var gi = 0; gi<2; gi++)	{
				group	= trackGroups[gi];
				for(var ti=0; ti<group.numTracks; ti++){
					var track		= group[ti];
					var clips		= track.clips;
					for(var ci=0; ci<clips.numTracks; ci++){
						var clip	= clips[ci];
						if (clip.getSpeed() !== 1){
							clip.setSelected(true, updateUI);
							numRetimedClips++;
						}
					}
				}
			}
			$._PPP_.updateEventPanel(numRetimedClips + " retimed clips found.");
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	selectReversedClips : function() {
		var sequence		= app.project.activeSequence;
		var numReversedClips = 0;
		if (sequence){
			var trackGroups			= [ sequence.audioTracks, sequence.videoTracks ];
			var trackGroupNames		= [ "audioTracks", "videoTracks" ];
			var updateUI			= true;

			for(var gi = 0; gi<2; gi++)	{
				for(var ti=0; ti<group.numTracks; ti++){
					for(var ci=0; ci < group[ti].clips.numTracks; ci++){
						var clip = group[ti].clips[ci];
						var isReversed = clip.isSpeedReversed();
						if (isReversed){
							clip.setSelected(isReversed, updateUI);
							numReversedClips++;
						}
					}
				}
			}
			$._PPP_.updateEventPanel(numReversedClips + " reversed clips found.");
		} else {
			$._PPP_.updateEventPanel("No active sequence.");
		}
	},

	logConsoleOutput : function() {
		app.enableQE();
		var logFileName = "PPro_Console_output.txt"
		var outFolder	= Folder.selectDialog("Where do you want to save the log file?");
		if (outFolder){
			var entireOutputPath = outFolder.fsName + $._PPP_.getSep() + logFileName;
			var result = qe.executeConsoleCommand("con.openlog " + entireOutputPath);
			$._PPP_.updateEventPanel("Log opened at " + entireOutputPath + ".");
		}
	},

	closeLog : function() {
		app.enableQE();
		qe.executeConsoleCommand("con.closelog");
	},

	stitch : function(presetPath) {
		var viewIDs = app.getProjectViewIDs();
		var allPathsToStitch = "";

        for (var a = 0; a < app.projects.numProjects; a++){
            var currentProject = app.getProjectFromViewID(viewIDs[a]);
            if (currentProject){
                if (currentProject.documentID === app.project.documentID){	// We're in the right project!
                    var selectedItems = app.getProjectViewSelection(viewIDs[a]);
					if (selectedItems.length){
						for (var b = 0; b < selectedItems.length; b++){
							var currentItem = selectedItems[b];
							if (currentItem){
								if ((!currentItem.isSequence()) && (currentItem.type !== ProjectItemType.BIN)){ // For every selected item which isn't a bin or sequence...
									allPathsToStitch += currentItem.getMediaPath();
										allPathsToStitch += ";";
								}
							}
						}

						var AMEString = "var fe = app.getFrontend(); fe.stitchFiles(\"" + allPathsToStitch + "\"";
						var addendum = ", \"H.264\", \"" + presetPath + "\", "  + "\"(This path parameter is never used)\");";

						AMEString += addendum;

						// 3. Send Command to AME for Export //
						var bt      = new BridgeTalk();
						bt.target   = 'ame';
						bt.body = AMEString;
						bt.send();



					}
                }
            }
        }
	},

	clearESTKConsole : function() {
		var bt 		= new BridgeTalk();
		bt.target 	= 'estoolkit-4.0';
		bt.body 	= function(){
    		app.clc();
    	}.toSource()+"()";
		bt.send();
	},

	testfunction : function() {
		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		//Update Klant_Log file
		//var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNr + "_Render_Log.txt");
		//var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNr + "_Klant_Log.txt");
		//generateFilteredLog(filePath, projNr, targetFilePath);

		var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNum + "_Render_Log.txt");
		var dirs = filePath.readdir(filePath);

		alert(dirs);
	},

	updateklantlog : function() {
		var projName = app.project.name;
		var projNr = projName.slice(0,5);

		projNum = prompt("Van welk projectnummer wil je de Klant Log updaten?", projNr);

		//Update Klant_Log file
		var filePath = new File("Volumes/Mediapool/_JSON/Render_Logs/" + projNum + "_Render_Log.txt");
		var targetFilePath = new File("Volumes/Mediapool/_JSON/Klant_Logs/" + projNum + "_Klant_Log.txt");
		generateFilteredLog(filePath, projNum, targetFilePath);
	}
};

function writeLog(fileObj, newContent, encoding) {
	encoding = encoding || "utf-8";
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	var parentFolder = fileObj.parent;
	if (!parentFolder.exists && !parentFolder.create())
			throw new Error("Cannot create file in path " + fileObj.fsName);
	fileObj.encoding = encoding;
	fileObj.open("a");
	fileObj.write(newContent);
	fileObj.close();
	return fileObj;
}

function changeLogPreviews(fileObj, numSeqs) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");
	var changeLine = splitted[2];
	var splittedLine = changeLine.split(" ");
	var changePos = splittedLine.length-1;
	var newNumber = parseInt(splittedLine[changePos])+numSeqs;
	var newLine = "Aantal previews: " + newNumber;
	var newContent = content.replace(changeLine, newLine);
	fileObj.open("w");
	fileObj.write(newContent);
	fileObj.close();
}

function changeLogOnline(fileObj, numSeqs) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");
	var changeLine = splitted[3];
	var splittedLine = changeLine.split(" ");
	var changePos = splittedLine.length-1;
	var newNumber = parseInt(splittedLine[changePos])+numSeqs;
	var newLine = "Aantal online kopieen: " + newNumber;
	var newContent = content.replace(changeLine, newLine);
	fileObj.open("w");
	fileObj.write(newContent);
	fileObj.close();
}

function changeLogMXF(fileObj, numSeqs) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");
	var changeLine = splitted[4];
	var splittedLine = changeLine.split(" ");
	var changePos = splittedLine.length-1;
	var newNumber = parseInt(splittedLine[changePos])+numSeqs;
	var newLine = "Aantal TV kopieen: " + newNumber;
	var newContent = content.replace(changeLine, newLine);
	fileObj.open("w");
	fileObj.write(newContent);
	fileObj.close();
}

function changeLogAudio(fileObj, numSeqs) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");
	var changeLine = splitted[5];
	var splittedLine = changeLine.split(" ");
	var changePos = splittedLine.length-1;
	var newNumber = parseInt(splittedLine[changePos])+numSeqs;
	var newLine = "Aantal audio mixen: " + newNumber;
	var newContent = content.replace(changeLine, newLine);
	fileObj.open("w");
	fileObj.write(newContent);
	fileObj.close();
}

function changeLogAfwijkend(fileObj, numSeqs) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");
	var changeLine = splitted[6];
	var splittedLine = changeLine.split(" ");
	var changePos = splittedLine.length-1;
	var newNumber = parseInt(splittedLine[changePos])+numSeqs;
	var newLine = "Aantal afwijkende formaten: " + newNumber;
	var newContent = content.replace(changeLine, newLine);
	fileObj.open("w");
	fileObj.write(newContent);
	fileObj.close();
}

function checkLog(fileObj, checkContent) {
	var checkResult = false;
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	fileObj.open("r");
	content = fileObj.read();
	regexTest = new RegExp(checkContent);
	if (regexTest.test(content)) { //regex met variable, todo
		checkResult = true;
	}
	fileObj.close();
	return checkResult;
}

function generateFilteredLog(fileObj, projNr, targetFileObj) {
	fileObj = (fileObj instanceof File) ? fileObj : new File(fileObj);
	targetFileObj = (targetFileObj instanceof File) ? targetFileObj : new File(targetFileObj);
	fileObj.open("r");
	content = fileObj.read();
	fileObj.close();

	//First stage of filtering, taking out any line with 'NIER DOORBEREKENEN' or .mxf
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");

	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/NIET DOORBEREKENEN/i) || splitted[i].match(/\.mxf/i)) {
			splitted.splice(i, 1);
			i-- ;
		}
	}

	//Combine array back together and perform second stage of filtering, taking out headers that don't have renders underneath them
	content = splitted.join('\n');
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");

	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/Aantal:/i)) {
			if (!splitted[i+2].match(/-/)) {
				splitted.splice(i-1, 4);
				i-- ;
			}
		}
	}

	//Combine array back together and perform third stage of filtering, recalculating totals on top of the file
	content = splitted.join('\n');
	var numberOfLineBreaks = (content.match(/\n/g)||[]).length;
	var splitted = content.split("\n");

	//Preview files
	var totalNum = 0;
	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/Preview Files/)) {
			totalNum += parseInt(splitted[i].slice(splitted[i].lastIndexOf(":")+1,splitted[i].length));
		}
	}
	splitted[2] = "Aantal previews: " + totalNum;

	//Online files
	var totalNum = 0;
	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/Online Files/)) {
			totalNum += parseInt(splitted[i].slice(splitted[i].lastIndexOf(":")+1,splitted[i].length));
		}
	}
	splitted[3] = "Aantal online kopieen: " + totalNum;

	//Audio Online/TV
	var totalNum = 0;
	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/Audio Online/)) {
			totalNum += parseInt(splitted[i].slice(splitted[i].lastIndexOf(":")+1,splitted[i].length));
		}
	}
	splitted[4] = "Aantal audio mixen: " + totalNum;

	//Afwijkende files
	var totalNum = 0;
	for( var i = 0; i < splitted.length; i++){
		if (splitted[i].match(/Afwijkende Files/)) {
			totalNum += parseInt(splitted[i].slice(splitted[i].lastIndexOf(":")+1,splitted[i].length));
		}
	}
	splitted[5] = "Aantal afwijkende formaten: " + totalNum;

	splitted.splice(6,1);

	//Write content to the filtered Klant_Log.txt file
	newContent = splitted.join('\n');

	targetFileObj.open("w");
	targetFileObj.write(newContent);
	targetFileObj.close();
}



/*

CheckA1: kijkwijzer;
CheckA2: Onderitels;
CheckA3: Eindkaart;
CheckA4: Audio;

*/
