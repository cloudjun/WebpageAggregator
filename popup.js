// linking the key-value-pairs is optional
// if no argument is provided, linkItems === undefined, i.e. !== false
// --> linking will be enabled
function Map(linkItems) {
    this.current = undefined;
    this.size = 0;

    if(linkItems === false)
        this.disableLinking();
}

Map.noop = function() {
    return this;
};

Map.illegal = function() {
    throw new Error("illegal operation for maps without linking");
};

// map initialisation from existing object
// doesn't add inherited properties if not explicitly instructed to:
// omitting foreignKeys means foreignKeys === undefined, i.e. == false
// --> inherited properties won't be added
Map.from = function(obj, foreignKeys) {
    var map = new Map;

    for(var prop in obj) {
        if(foreignKeys || obj.hasOwnProperty(prop))
            map.put(prop, obj[prop]);
    }

    return map;
};

Map.prototype.disableLinking = function() {
    this.link = Map.noop;
    this.unlink = Map.noop;
    this.disableLinking = Map.noop;
    this.next = Map.illegal;
    this.key = Map.illegal;
    this.value = Map.illegal;
    this.removeAll = Map.illegal;

    return this;
};

// overwrite in Map instance if necessary
Map.prototype.hash = function(value) {
    return (typeof value) + ' ' + (value instanceof Object ?
        (value.__hash || (value.__hash = ++arguments.callee.current)) :
        value.toString());
};

Map.prototype.hash.current = 0;

// --- mapping functions

Map.prototype.get = function(key) {
    var item = this[this.hash(key)];
    return item === undefined ? undefined : item.value;
};

Map.prototype.put = function(key, value) {
    var hash = this.hash(key);

    if(this[hash] === undefined) {
        var item = { key : key, value : value };
        this[hash] = item;

        this.link(item);
        ++this.size;
    }
    else this[hash].value = value;

    return this;
};

Map.prototype.remove = function(key) {
    var hash = this.hash(key);
    var item = this[hash];

    if(item !== undefined) {
        --this.size;
        this.unlink(item);

        delete this[hash];
    }

    return this;
};

// only works if linked
Map.prototype.removeAll = function() {
    while(this.size)
        this.remove(this.key());

    return this;
};

// --- linked list helper functions

Map.prototype.link = function(item) {
    if(this.size == 0) {
        item.prev = item;
        item.next = item;
        this.current = item;
    }
    else {
        item.prev = this.current.prev;
        item.prev.next = item;
        item.next = this.current;
        this.current.prev = item;
    }
};

Map.prototype.unlink = function(item) {
    if(this.size == 0)
        this.current = undefined;
    else {
        item.prev.next = item.next;
        item.next.prev = item.prev;
        if(item === this.current)
            this.current = item.next;
    }
};

// --- iterator functions - only work if map is linked

Map.prototype.next = function() {
    this.current = this.current.next;
};

Map.prototype.key = function() {
    return this.current.key;
};

Map.prototype.value = function() {
    return this.current.value;
};

















var datetime_regex = /^(\d{4})-(\d{2})-(\d{2}).(\d{2}):(\d{2}):(\d{2}),(\d{3})$/;
var content = "";
var counter = 0;
var logs = new Array();  // the aggregated log
var timeLogs = new Array(); // the timeLogs array is the int format of the log entry time
var colorLogs = new Array(); // track the color index for each log
var lastlines = new Array(); // the last line of the previous log, for each log file
var filterWiths = new Array(); // the filterWith string
var filterWithouts = new Array(); // the filterWith string
var strUrls = new Array(); // the log files' url to query
var workers = new Array(); // the references to all the polling threads
var pollIntervals = new Array(); // poll every xx seconds
var pollLines = new Array(); // poll xxx lines for each request
var pollColors = new Array(); // the color for each log file
var isScrollEnabled = true;
var logFileNames = new Array();

function printLog(log) {
    var currentdate = new Date();
    var datetime =  currentdate.getFullYear() + "-"
                    + (currentdate.getMonth()+1) + "-"
                    + currentdate.getDate() + " "
                    + currentdate.getHours() + ":"
                    + currentdate.getMinutes() + ":"
                    + currentdate.getSeconds();
    document.getElementById("logArea").value += datetime + " " + log + "\n";
}

function binaryIndexOf(searchElement) {
  var minIndex = 0;
  var maxIndex = this.length - 1;
  var currentIndex;
  var currentElement;

  while (minIndex <= maxIndex) {
      currentIndex = (minIndex + maxIndex) / 2 | 0;
      currentElement = this[currentIndex];
      if (currentElement < searchElement) {
          minIndex = currentIndex + 1;
      }
      else if (currentElement > searchElement) {
          maxIndex = currentIndex - 1;
      }
      else {
          return currentIndex;
      }
  }
  return maxIndex;
}

function saveOptions() {
    var select = document.getElementById("color");
    var color = select.children[select.selectedIndex].value;
    localStorage["favColor"] = color;
}

function eraseOptions() {
    localStorage.removeItem("favColor");
    location.reload();
}

function getLog(strUrl, logFileIndex) {
    var req = new XMLHttpRequest();
    req.open("GET", strUrl, true);
    // alert("req open");
    req.onreadystatechange=function() {
        if (req.readyState==4) {
            if (req.status==200)
            {
                printLog("got response for " + logFileNames[logFileIndex]);
                handleLog(req.responseText, logFileIndex);
            }
            else if (req.status==404) printLog("Url doesn't exist: " + logFileNames[logFileIndex])
                else printLog("Error-Status is " + req.status + ": " +logFileNames[logFileIndex] )
            }
    }
    req.send();
    printLog("sending request: " + logFileNames[logFileIndex]);
    return req.responseText;
}

function getFileInfo(instanceUrl) {
    var req = new XMLHttpRequest();
    req.open("GET", instanceUrl, true);
    // alert("req open");
    req.onreadystatechange=function() {
        if (req.readyState==4) {
            if (req.status==200)
            {
            }
            else if (req.status==404) console.info("URL doesn't exist!")
                else console.info("Error: Status is " + req.status)
            }
    }
    req.send();
    // alert("req sent");
    return req.responseText;
}

// move the array one position toward the higher end, starting from pos+1
function moveForward(theArray, pos) {
    for (var i = theArray.length; i > pos; i--) {
        theArray[i] = theArray[i-1];
    }
}

function handleLog(response, logFileIndex) {
    var newlineIndex = 0; // where the line new starts
    var tempDiv = document.getElementById("temp_parser");
    tempDiv.innerHTML = response;
    var divs = tempDiv.getElementsByTagName("div");
    var pres = divs[13].getElementsByTagName("pre");
    // var len = pres[0].innerHTML.length;
    // var logString = pres[0].innerHTML.substring(1, len-1);
    var lines = pres[0].innerHTML.split(/\n/);

    // compare with the previous logs to find out the delta, by comparing the last line from the previous log to the first line (then 2nd, 3rd...) of the current log
    if (lastlines[logFileIndex] != "") {
        for (var i = 0; i < lines.length; i++) {
            if (lastlines[logFileIndex] == lines[i]) {
                // we assume all the lines after i are new
                newlineIndex = i + 1;
                break;
            }
        }
    }
    // get the last line for this poll
    for (var i = lines.length-1; i >= 0; i--) {
        if (lines[i].trim() != "") {
            lastlines[logFileIndex] = lines[i];
            break;
        }
    }

    // make all the new lines timestamp based
    var newLines = new Array();
    var t = 0;
    for (var i = newlineIndex; i < lines.length; i++) {
        if (lines[i].trim() == "") continue; // drop any empty line
        var datetimestamp = lines[i].substring(0, 23);
        if (datetime_regex.test(datetimestamp)) {
            newLines[t] = lines[i];
            t++;
        } else {
            // it does not start with a timestamp, make it part of the logs from the last timestamp
            newLines[t] += lines[i] + "\n";
        }
    }

    if (newLines.length ==0) return;

    // only one line, and no timestamp, we are not going to deal with it
    if (newLines.length == 1)
        if (!datetime_regex.test(newLines[0].substring(0,23)))
            return;

    // check if newLines[0] has a time stamp, if not make newLines[i+1] become newLines[i], etc.
    if (!datetime_regex.test(newLines[0].substring(0,23))) {
        for (var i = 1; i < newLines.length; i++) {
            newLines[i-1] = newLines[i];
        };
        newLines[i] = null;
    }

    var timestamps = new Array();
    var timestamp = parseInt(newLines[0].substring(5, 23).replace(/-|:| |,/g,''));
    timestamps[0] = timestamp;
    var startingIndexInLogs = binaryIndexOf.call(timeLogs, timestamp);
    var lastInsertPosition = startingIndexInLogs;
    var newPositions = new Array();
    newPositions[0] = startingIndexInLogs;
    for (var i = 1; i < newLines.length; i++) {
        // get the int format of the timestamp
        timestamp = parseInt(newLines[i].substring(5, 23).replace(/-|:| |,/g,''));
        timestamps[i] = timestamp;

        // compare each new log line timestamp with the existing log timestamps
        if (lastInsertPosition >= timeLogs.length-1) {
            // new log lines are after all the existing logs
            newPositions[i] = timeLogs.length-1;
        }
        for (var j = lastInsertPosition+1; j < timeLogs.length; j++) {
            if (timestamp < timeLogs[j]) { // find the first index which existing timestamp is bigger than the new log timestamp
                // existing log timestamp is bigger, so we should insert the new log before that
                newPositions[i] = j-1;
                lastInsertPosition = newPositions[i];
                break;
            }
        }
        if (typeof newPositions[i] == 'undefined') {
            newPositions[i] = timeLogs.length-1;
            lastInsertPosition = newPositions[i];
        }
    }

    // now we have the newLines[] for the new logs, and the newPositions[] for the insert positions in the existing logs
    var currentInsertPosition = 0;
    var oldLogSize = logs.length;
    for (var i = 0; i < newLines.length; i++) {
        currentInsertPosition = newPositions[i] + i;
        if (newPositions[i] >= oldLogSize-1) {
            // the new position is after all the old log lines
            var len = logs.length;
            logs[len] = newLines[i];
            colorLogs[len] = logFileIndex;
            timeLogs[len] = timestamps[i];
        } else {
            moveForward(logs, currentInsertPosition); // make room for the inserting value
            moveForward(colorLogs, currentInsertPosition);
            moveForward(timeLogs, currentInsertPosition);
            logs[currentInsertPosition+1] = newLines[i];
            colorLogs[currentInsertPosition+1] = logFileIndex;
            timeLogs[currentInsertPosition+1] = timestamps[i];
        }
        // counter++;
    }

    if (isScrollEnabled)
        updateContent(0, logs.length);
}

function updateContent(from, to) {
    content = "";

    if (filterWiths.length == 0 && filterWithouts.length == 0) {
        for (var i = from; i < to; i++) {
            content += "<font style=\"background-color:" + pollColors[colorLogs[i]] + ";\">" + logs[i] + "</font>\n";
        }
    }
    else if (filterWithouts.length != 0) {
        for (var k = from; k < to; k++) {
            var textExists = false;
            var lowercase = logs[k].toLowerCase();
            for (var i = 0; i < filterWithouts.length; i++) {
                if (lowercase.indexOf(filterWithouts[i]) != -1) {
                    textExists = true;
                    break;
                }
            }
            if (textExists) {
                // skip this line, we do not want it
                continue;
            } else {
                if (filterWiths.length != 0) {
                    for (var i = 0; i < filterWiths.length; i++) {
                        if (lowercase.indexOf(filterWiths[i]) > -1) {
                            textExists = true;
                            break;
                        }
                    }
                    if (textExists)
                        content += "<font style=\"background-color:" + pollColors[colorLogs[k]] + ";\">" + logs[k] + "</font>\n";
                } else {
                    // no filter-with exists
                    content += "<font style=\"background-color:" + pollColors[colorLogs[k]] + ";\">" + logs[k] + "</font>\n";
                }
            }
        }
    } else {             // only filterWith is available
        for (var k = from; k < to; k++) {
            var textExists = false;
            var lowercase = logs[k].toLowerCase();
            for (var i = 0; i < filterWiths.length; i++) {
                if (lowercase.indexOf(filterWiths[i]) > -1) {
                    textExists = true;
                    break;
                }
            }
            if (textExists)
                content += "<font style=\"background-color:" + pollColors[colorLogs[k]] + ";\">" + logs[k] + "</font>\n";
        }
    }
    document.getElementById("log_display").innerHTML = unescape(content);
}

function getFilters() {
    filterWiths = new Array();
    filterWithouts = new Array();

    var fws = document.getElementById("filterWithArea").getElementsByTagName("input");
    var k = 0;
    for (var i = 0; i < fws.length; i++) {
        if (fws[i].value) { // if the input is not empty
            filterWiths[k] = fws[i].value.toLowerCase();
            k++;
        }
    };

    var fwos = document.getElementById("filterWithoutArea").getElementsByTagName("input");
    k = 0;
    for (var i = 0; i < fwos.length; i++) {
        if (fwos[i].value) { // if the input is not empty
            filterWithouts[i] = fwos[i].value.toLowerCase();
            k++;
        }
    };
}

function onClickGo(e) {
    for (var i = 0; i < workers.length; i++) {
        clearInterval(workers[i]);
    };

    getFilters();
    isScrollEnabled = true;
    var scrollButton = document.getElementById('stopScrollButton');
    scrollButton.textContent = "disable scroll";
    var pollButton = document.getElementById('stopPollButton');
    pollButton.textContent ="disable poll";
    pollButton.disabled = false;

    for (var i = 0; i < strUrls.length; i++) {
        pollIntervals[i] = document.getElementById("config_interval_" + i).value * 1000;
        pollLines[i] = document.getElementById("config_lines_" + i).value;
        pollColors[i] = document.getElementById("config_color_" + i).value;
        strUrls[i] = strUrls[i].replace(/undefined/g, pollLines[i]);
        getLog(strUrls[i], i);
        lastlines[i] = "";
        workers[i] = setInterval(getLog.bind(null, strUrls[i], i), pollIntervals[i]);
    };
}

function onClickStopPoll(e) {
    for (var i = 0; i < workers.length; i++) {
        clearInterval(workers[i]);
    };
    var pollButton = document.getElementById('stopPollButton');
    pollButton.textContent = "poll disabled";
    pollButton.disabled = true;
}

function onClickStopScroll(e) {
    if (isScrollEnabled) {
        isScrollEnabled = false;
        var scrollButton = document.getElementById('stopScrollButton');
        scrollButton.textContent = "enable scroll";
    } else {
        isScrollEnabled = true;
        var scrollButton = document.getElementById('stopScrollButton');
        scrollButton.textContent = "disable scroll";
    }
}

function addFilterWith() {
    var div = document.getElementById('filterWithArea');
    var newInput = document.createElement('input');
    div.appendChild(newInput);
}

function addFilterWithout() {
    var div = document.getElementById('filterWithoutArea');
    var newInput = document.createElement('input');
    div.appendChild(newInput);
}

function goToTime() {
    var fromString = document.getElementById('filterTimeFrom').value;
    var fromTS = parseInt(fromString.substring(5,23).replace(/-|:| |,/g,''));
    var toString = document.getElementById('filterTimeTo').value;
    var toTS = parseInt(toString.substring(5,23).replace(/-|:| |,/g,''));

    // we assume that the logs for that time period already exists
    getFilters();
    var start = binaryIndexOf.call(timeLogs, fromTS);
    var end = binaryIndexOf.call(timeLogs, toTS);
    updateContent(start, end);
}

function dumpTxt() {
    var txt = "";
    for (var i = 0; i < logs.length; i++) {
        txt += escape(logs[i] + "\n");
    };
    // window.open("data:text/plain;charset=utf-8," + txt);
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + txt);
    pom.setAttribute('download', 'dap.log');
    pom.click();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById("goButton").addEventListener('click', onClickGo);
  document.getElementById("stopScrollButton").addEventListener('click', onClickStopScroll);
  document.getElementById("stopPollButton").addEventListener('click', onClickStopPoll);
  document.getElementById("addFilterWithButton").addEventListener('click', addFilterWith);
  document.getElementById("addFilterWithoutButton").addEventListener('click', addFilterWithout);
  document.getElementById("goToTimeButton").addEventListener('click', goToTime);
  document.getElementById("dumpTxtButton").addEventListener('click', dumpTxt);
});

$(function () {
    var jsonData = [
						{
							'id': 'server1',
							'text': 'server1',
							'children': [
								{
									'text': 'abc.logserver.com',
									'children': [
										{
											'text': 'shortname.log',
											'id': 'real-name.log'
										}
									]
								}
							]
						}
					];
	
    // var jsonConverted = $.parseJSON(jsonData);
    $('#jstree').jstree({
        "core" : {
            "animation" : 0,
            "data" : jsonData
        },
        "checkbox" : {
            "three_state" : false
        },
        "plugins" : [ "wholerow", "checkbox"],
    });
    $('#jstree').on("changed.jstree", function (e, data) {
        strUrls = new Array();
        logFileNames = new Array();
        var selected = data.selected;
        var configArea = document.getElementById('config');
        configArea.innerHTML = null;
        var inner = "";
        for (var i = 0; i < selected.length; i++) {
            var instance = selected[i].split("_");
            // var queryUrl = "https://abc.logserver.com/logs/?id="+instance[0]+"&instance="+instance[1];
            var queryUrl = "https://abc.logserver.com/logs/legacyview/?param1="+instance[0]+"&param2="+instance[2]+"&param3="+instance[1]+"&param4"+instance[3];
            strUrls[i] = queryUrl;
            logFileNames[i] = selected[i];

            // configArea.appendChild(selected[i] + "<input type='text' id='config_" + selected + "'/>");
            inner = inner + "interval(s):<input type='text' size='5' value='20' id='config_interval_" + i + "'/>";
            inner = inner + "lines:<input type='text' size='6' value='200' id='config_lines_" + i + "'/>";
            inner = inner + "color:<input type='text' size='16' value='lightblue' id='config_color_" + i + "'/> - "
            inner = inner + selected[i] + "<br>";
        };
        configArea.innerHTML = inner;

        // var resp = getFileInfo(queryUrl);
        // var tempDiv = document.createElement('temp_div');
        // tempDiv.innerHTML = resp;
        // var nodes = tempDiv.getElementsByClassName("server_name");
        // for (var i = 0; i < nodes.length; i++) {
        //     // var newNode = {state: "open", data: nodes[i].innerText};
        //     // var newNode = {'data' : [{ "id" : "ajson1", "text" : "Simple root node" }]};
        //     var newNode = { "data": "mydata" };
        //     var parent = $('#jstree').jstree('get_selected');
        //     $('#jstree').jstree("create_node", $("#ja0012_intcr"), "inside", newNode, false, true);
        // };

        // var files = tempDiv.getElementsByClassName("log_file_td");
        // var filenames;
        // for (var i = 0; i < files.length; i++) {
        //     filenames[i] = files[i].innerText;
        // };
    });
});
