/*
 * Pharmit Web Client
 * Copyright 2015 David R Koes and University of Pittsburgh
 *  The JavaScript code in this page is free software: you can
    redistribute it and/or modify it under the terms of the GNU
    General Public License (GNU GPL) as published by the Free Software
    Foundation, either version 2 of the License, or (at your option)
    any later version.  The code is distributed WITHOUT ANY WARRANTY;
    without even the implied warranty of MERCHANTABILITY or FITNESS
    FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 */
/*
	query.js
	Left div that manages the query information.
*/

var Pharmit = Pharmit || {};

Pharmit.Query = (function() {
	
	var defaultFeature = {name:"Hydrophobic",x:0,y:0,z:0,radius:1.0,enabled:true,vector_on:0,minsize:"",maxsize:"",svector:null,hasvec:false};
	var pharmaGistRegEx = /@<TRIPOS>MOLECULE[^@]*?@<TRIPOS>ATOM\n(\s*\d+\s*(ACC|DON|CAT|ANI|HYD|AR).*)*\n@<TRIPOS>BOND\n/g;

	var endsWith = function(str, suffix) {
	    return str.indexOf(suffix, str.length - suffix.length) !== -1;
	};
	
	function Query(element, viewer, results) {
		//private variables and functions
		var querydiv = $('<div>').addClass('pharmit_query pharmit_overlay');
		var features = null;
		var featureheading = null;
		var receptorData = null;
		var receptorName = null; //filename (need ext)
		var receptorKey = null; //md5 key to avoid transfering full structure
		var ligandData = null;
		var ligandName = null;
		
		var doSearch = function() {
			var qobj = getQueryObj();
			//remove receptor and ligand data to reduce size of query
			if(qobj.receptor && qobj.reckey) {
				delete qobj.receptor; //server can get data w/reckey if need be
			}
			delete qobj.ligand;
			
			//results manages queries
			results.phquery(qobj);
		};
		
		//boiler plate for asynchronously extracting text from a file input
		var readText = function(input,func) {
			if(input.files.length > 0) {
				var file = input.files[0];
				var reader = new FileReader();
			    reader.onload = function(evt) {
			    	func(evt.target.result,file.name);
			    };
			    reader.readAsText(file);
			    $(input).val('');
			}
		};
		
		//take an array of pharmacophore features (query.points) and
		//put them in the query view
		var setFeatures = function(featurearray) {
			var start = new Date().getTime();
			
			viewer.disableRendering();
			//while we're removing/adding bunches of features, don't bother rendering until the end
			
			features.detach();
			//replace features
			var old = features.children();
			$.each(old, function(i, fdiv) {
				fdiv.feature.deleteFeature();
			});
			
			features.empty();
			if(featurearray) {
				$.each(featurearray, function(i, pt) {
					new Feature(viewer, features, pt);
				});
			}
			features.accordion("option","active",false);
			features.accordion("refresh");

			featureheading.after(features); 
			
			viewer.enableRendering();
			var end = new Date().getTime();
			var time = end - start;
			console.log('setFeatures time: ' + time);
		};
		
		//query server to get pharmacophore
		//result replaces any existing featuers
		var loadFeatures = function(data, lname) {
			
			ligandData = null;
			ligandName = null;
			var postData = {
					cmd: 'getpharma',
					ligand: data,
					ligandname: lname,
			};
			
			if(receptorName) {
				if(receptorKey) { //most likely
					postData.reckey = receptorKey;
					postData.recname = receptorName;
				} else {
					postData.receptor = receptorData;
					postData.recname = receptorName;	
				}
			}
			
			$.post(Pharmit.server, postData, null, 'json').done(function(ret) {
				if(ret.status) { //success
					if(ret.mol) {
						//this was molecular data, save it
						ligandName = lname;
						ligandData = data;
						
						//pharmagist files embed the pharmacophore with the molecule, need to remove it
						if(endsWith(lname,"mol2") && pharmaGistRegEx.test(data)) {
							data = data.replace(pharmaGistRegEx, '');
						}
					
						viewer.setLigand(data, lname);						
					}
					setFeatures(ret.points);					
					
				} else {
					alert("Error: "+ret.msg);
				}
			}).fail(function() {
				alert("Error contacting server.  Please inform "+Pharmit.email+ " if this problem persists.");
			});
			
		};
		
		//set receptor variables, show receptor in viewer,
		//and register receptor with server
		var loadReceptor = function(data, fname) {
			
			if(!data || !fname)
				return;
			
			receptorData = data;
			receptorName = fname;
			viewer.setReceptor(data, fname);
			
			//calculate md5 of receptor
			receptorKey = null; //but don't set it until we get ack from server
			var rKey = Pharmit.hex_md5(receptorData);	

			$.post( Pharmit.server, { 
				cmd: "setreceptor",
				key: rKey,
				receptor: receptorData
				}).done(function() {
						receptorKey = rKey;
				}); //key setting isn't critical, so skip the the fail handler
		};
		

		//order features so enabled are on top and within the enabled/disabled
		//categories features are sorted by type
		var sortFeatures = function() {
			var fdivs = features.children().detach();
			
			fdivs.sort(function(a,b) {
				var x = a.feature.obj;
				var y = b.feature.obj;
				
				if(x.enabled != y.enabled) {
					return y.enabled-x.enabled;
				}
				else if(x.name != y.name) {
					return x.name.localeCompare(y.name);
				}
				return x.radius-y.radius;
				
			});
			
			features.append(fdivs);
		};
		
		var loadSession = this.loadSession = function(data) {

			var query = data; //support passing an object directly
			if(typeof(data) == "string") 
				query = $.parseJSON(data);
 
			setFeatures(query.points);
			
			//get named settings, including visualization
			$.each(query, function(key,value) {
				var i = $('input[name='+key+']');
				if(i.length) {
					i.val(value).change();
				}
			});
			
			loadReceptor(query.receptor, query.recname);		
			
			viewer.setReceptor(receptorData, receptorName);
			
			if(query.sdf) { //backwards compat with zincpharmer
				ligandData = decodeURIComponent(query.sdf);
				//try to guess format
				if(ligandData.match(/^@<TRIPOS>MOLECULE/)) {
					ligandName = ".mol2";
				} else if(ligandData.match(/^HETATM/) || ligandData.match(/^ATOM/)) {
					ligandName = ".pdb";
				} else if(ligandData.match(/^.*\n.*\n.\s*(\d+)\s+(\d+)/)){
					ligandName = ".sdf"; //could look at line 3
				} else {
					ligandName = ".xyz";
				}
			} else {
				ligandData = query.ligand;
				ligandName = query.ligandFormat;
			}
			viewer.setLigand(ligandData, ligandName);
			
			if(query.backgroundcolor) //this is the id of the correct radio button
				$('#'+query.backgroundcolor).prop('checked',true).change();
			viewer.setView(query.view);			

		};
		
		//return the query object
		var getQueryObj = function() {
			
			//get features
			var ret = {};
			ret.points = [];
			
			$.each(features.children(), function(key, fdiv) {
				ret.points.push(fdiv.feature.obj);
			});
			//everything with a name is something we want to save
			
			$.each($('[name]',querydiv), function(index, elem) {
				if(elem.name) {
					var val = elem.value;
					if($.isNumeric(elem.value)) {
						val = Number(elem.value);
					}
					ret[elem.name] = val;
				}
			});
			
			//radio buttons have to have the same name, so have to hack around background color
			ret.backgroundcolor = 'whiteBackground';
			if($('#blackBackground').prop('checked')) ret.backgroundcolor = 'blackBackground';
			
			//structures
			ret.ligand = ligandData;
			ret.ligandFormat = ligandName;
			ret.receptor = receptorData;
			ret.recname = receptorName;
			ret.receptorid = receptorKey;
			return ret;
		};
		
		var saveSession = function() {
			
			//IE doesn't support arbitrary data url's so much echo through a server
			//to download a file that is already on the client's machine
			// echo data back as a file to save
			var cmd = Pharmit.server+'?cmd=savedata&type="text%2Fphjson"&fname="pharmit.json"';
			var form = $('<form>', { 'action': cmd, 'method': 'post'});
			var qobj = getQueryObj();
			form.append($('<input>', {'name':"data",'type':"hidden",value:JSON.stringify(qobj,null,4)}));
			form.appendTo(document.body);
			form.submit();
			$(form).remove();			

		};
		
		
		//create a split button from a list of vendors and prepend it to header
		var createSearchButton = function(header,vendors) {
			var buttons = $('<div>').addClass('pharmit_searchdiv');
			var run = $('<button>Search '+vendors[0]+'</button>').appendTo(buttons).button();
			var select = $('<button>Select subset to search</button>').appendTo(buttons).button({text: false, icons: {primary: "ui-icon-triangle-1-s"}});
			
			buttons.buttonset();
			var ul = $('<ul>').appendTo($('body')).addClass('pharmit_floatmenu'); //can't be in query div because of overflow truncation
			var lis = [];
			for(var i = 0, n = vendors.length; i < n; i++) {
				lis[i] = '<li>'+vendors[i]+'</li>';
			}
			ul.append(lis);
			ul.hide().menu().on('menuselect', function(event, ui) {
				run.button("option",'label',"Search "+ui.item.text());
			});
			
			//handlers
			run.click(doSearch);
			select.click(
					function() {
						var menu = ul.show().position({
							my: "left top",
							at: "left buttom",
							of: this
						});
						$(document).one('click', function() { menu.hide(); });
						return false;
					});
			
			header.prepend(buttons);
		};
		
		
		//public variables and functions
		
		var closer = $('<div>').appendTo(querydiv).addClass('pharmit_leftclose');
		var closericon = $('<span>').addClass("ui-icon ui-icon-carat-1-w").appendTo(closer);
		
		//initialization code
		querydiv.resizable({handles: "e",
			resize: function(event, ui) {
				viewer.setLeft(ui.size.width);
			}
		});
		querydiv.disableSelection();
		

		closer.click(function() {
			if(closer.hasClass('pharmit_leftisclosed')) {
				closer.removeClass('pharmit_leftisclosed');
				closericon.removeClass('ui-icon-carat-1-e');
				closericon.addClass('ui-icon-carat-1-w');
				var start = querydiv.width();
				querydiv.css('width', ''); //restore stylesheet width	
				var target = querydiv.width();
				querydiv.width(start);
				
				querydiv.animate({width: target},{
					progress: function() { viewer.setLeft(querydiv.width());}
				}); 
				querydiv.resizable( "option", "disabled", false);

			} else { //close it 
				querydiv.animate({width: 0}, {
					progress: function() { viewer.setLeft(querydiv.width());}
					}); 
				//viewer.setLeft(0);
				closer.addClass('pharmit_leftisclosed');
				closericon.addClass('ui-icon-carat-1-e');
				closericon.removeClass('ui-icon-carat-1-w');			
				querydiv.resizable( "option", "disabled", true );
			}
		});
		
		var header = $('<div>').appendTo(querydiv).addClass("pharmit_queryheader");
		createSearchButton(header,['MolPort','ZINC']);
		
		//load features and load receptor
		var loaders = $('<div>').appendTo(header).addClass('pharmit_loaderdiv').addClass('pharmit_nowrap');
		var loadrec = $('<button>Load Receptor...</button>').button();
		var loadfeatures = $('<button>Load Features...</button>').button();
		
		//fileinput needs the file inputs in the dom
		element.append(querydiv);
		var loadrecfile = $('<input type="file">').appendTo(loaders).fileinput(loadrec).change(function(e) {readText(this, loadReceptor);});
		var loadfeaturesfile = $('<input type="file">').appendTo(loaders).fileinput(loadfeatures).change(function(e) {readText(this,loadFeatures);});		
		
		querydiv.detach();
		
		//query features
		var body = $('<div>').appendTo(querydiv).addClass("pharmit_querybody");
		var featuregroup = $('<div>').appendTo(body);
		featureheading = $('<div>Pharmacophore</div>').appendTo(featuregroup).addClass('pharmit_heading');
		features = $('<div>').appendTo(featuregroup);
		features.accordion({header: "> div > h3", 
			animate: true, 
			active: false,
			collapsible: true,
			heightStyle:'content',
			beforeActivate: function( event, ui ) { 
				var fdiv = null;
				
				//deslect all features
				var fdivs = features.children();
				$.each(fdivs, function(key,fdiv) {
					fdiv.feature.deselectFeature();
				});
				if(ui.newHeader.length > 0) { //being activated
					fdiv = ui.newHeader.parent();
					fdiv.get(0).feature.selectFeature();
				}

			}})
			.sortable({ //from jquery ui example
				axis: "y",
				handle: "h3",
				stop: function( event, ui ) {
				// IE doesn't register the blur when sorting
				// so trigger focusout handlers to remove .ui-state-focus
				ui.item.children( "h3" ).triggerHandler( "focusout" );
				// Refresh accordion to handle new order
				$( this ).accordion( "refresh" );
				}
				});
		
		var buttondiv = $('<div>').appendTo(featuregroup).addClass('pharmit_featurebuttons');
		var addbutton = $('<button>Add</button>').appendTo(buttondiv)
			.button({text: true, icons: {secondary: "ui-icon-circle-plus"}})
			.click(function() {new Feature(viewer, features, defaultFeature);}); //feature adds a reference to itself in its container
		var sortbutton = $('<button>Sort</button>').appendTo(buttondiv).button({text: true, icons: {secondary: "ui-icon ui-icon-carat-2-n-s"}}).click(sortFeatures);

		//filters
		var filtergroup = $('<div>').appendTo(body);
		$('<div>Filters</div>').appendTo(filtergroup).addClass('pharmit_heading');
		var filters = $('<div>').appendTo(filtergroup);		
		
		var heading = $('<h3>Hit Reduction<br></h3>').appendTo(filters);

		var hitreductions = $('<div>').addClass("pharmit_hitreduction").appendTo(filters);
		var reducetable = $('<table>').appendTo(hitreductions);
		
		var setReductionStyle = function() { //change style of headings of filters are specified
			if($('#reduceorienttext').val() !== '' ||
					$('#reduceconfstext').val() !== '' ||
					$('#reducehitstext').val() !== '') {
				heading.addClass('pharmit_filtermodified');
			} else {
				heading.removeClass('pharmit_filtermodified');
			}
		};
		

		var row = $('<tr>').addClass('pharmit_filterrow').appendTo(reducetable);
		$('<td>').append('<label title="Maximum number of orientations returned for each conformation" value="1" for="reduceorienttext">Max Hits per Conf:</label>').appendTo(row);
		var cell = $('<td>').appendTo(row);
		$('<input id="reduceorienttext" name="max-orient">').appendTo(cell).spinner({min: 0, stop: setReductionStyle}).change(setReductionStyle);
		
		row = $('<tr>').addClass('pharmit_filterrow').appendTo(reducetable);
		$('<td>').append('<label title="Maximum number of conformations returned for each compound" value="1" for="reduceconfstext">Max Hits per Mol:</label>').appendTo(row);
		cell = $('<td>').appendTo(row);
		$('<input id="reduceconfstext" name="reduceConfs">').appendTo(cell).spinner({min: 0, stop: setReductionStyle}).change(setReductionStyle);
		
		row = $('<tr>').addClass('pharmit_filterrow').appendTo(reducetable);
		$('<td>').append('<label title="Maximum number of hits returned" value="1" for="reducehitstext">Max Total Hits:</label>').appendTo(row);
		cell = $('<td>').appendTo(row);
		$('<input id="reducehitstext" name="max-hits">').appendTo(cell).spinner({min: 0, stop: setReductionStyle}).change(setReductionStyle);
		
		
		var screenheading = $('<h3>Hit Screening<br></h3>').appendTo(filters);
		var hitscreening = $('<div>').appendTo(filters).addClass('pharmit_hitscreening');
		var screentable = $('<table>').appendTo(hitscreening);
		
		var setScreensStyle = function() { //change style of headings of filters are specified
			if($('#minmolweight').val() !== '' ||
					$('#maxmolweight').val() !== '' ||
					$('#minnrot').val() !== '' ||
					$('#maxnrot').val() !== '')  {
				screenheading.addClass('pharmit_filtermodified');
			} else {
				screenheading.removeClass('pharmit_filtermodified');
			}
		};
		
		
		row = $('<tr>').addClass('pharmit_filterrow').appendTo(screentable);
		cell = $('<td>').appendTo(row);
		$('<input id="minmolweight" name="minMolWeight">').appendTo(cell).spinner({min: 0, stop: setScreensStyle}).change(setScreensStyle);
		$('<td>').appendTo(row).append($('<label title="Minimum/maximum molecular weight (weights are approximate)" value="1" for="maxmolweight">&le;  MolWeight &le;</label>'));
		cell = $('<td>').appendTo(row);
		$('<input id="maxmolweight" name=maxMolWeight>').appendTo(cell).spinner({min: 0, stop: setScreensStyle}).change(setScreensStyle);

		row = $('<tr>').addClass('pharmit_filterrow').appendTo(screentable);
		cell = $('<td>').appendTo(row);
		$('<input id="minnrot" name="minrotbonds">').appendTo(cell).spinner({min: 0, stop: setScreensStyle}).change(setScreensStyle);
		$('<td>').appendTo(row).append($('<label title="Minimum/maximum number of rotatable bonds" value="1" for="maxnrot"> &le;  RotBonds &le;</label>'));
		cell = $('<td>').appendTo(row);
		$('<input id="maxnrot" name="maxrotbonds">').appendTo(cell).spinner({min: 0, stop: setScreensStyle}).change(setScreensStyle);

		filters.accordion({animate: true, active: false, collapsible: true, heightStyle:'content'});
		
		//viewer settings
		var vizgroup = $('<div>').appendTo(body);
		$('<div>Visualization</div>').appendTo(vizgroup).addClass('pharmit_heading');
		var vizbody = $('<div>').appendTo(vizgroup).addClass('pharmit_vizdiv');
		viewer.appendViewerControls(vizbody);

		
		//load/save session
		var footer = $('<div>').appendTo(querydiv).addClass("pharmit_queryfooter");
		var bottomloaders = $('<div>').appendTo(footer).addClass("pharmit_bottomloaders").addClass('pharmit_nowrap');
		element.append(querydiv);

		var loadsession = $('<button>Load Session...</button>').button();
				
		var loadsessionfile = $('<input type="file">').appendTo(bottomloaders).fileinput(loadsession).change(function() {readText(this,loadSession);});	
		var savesession = $('<button>Save Session...</button>').appendTo(bottomloaders).button().click(saveSession);		
		
		viewer.setLeft(querydiv.width());

	}

	return Query;
})();