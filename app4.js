/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


// Form the CORS request to given url
// method   The method for the XMLHttpRequest (here GET)
// url      The url where to make the request
function createCORSRequest(method, url) {
    var xhr = new XMLHttpRequest();	  

    //set credentials	  
    xhr.withCredentials = true;

    if ("withCredentials" in xhr) {
          // XHR for Chrome/Firefox/Opera/Safari.
          xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined") {
          // XDomainRequest for IE.
          xhr = new XDomainRequest();
          xhr.open(method, url);
    } else {
          // CORS not supported.
          xhr = null;
    }
    return xhr;
}

// Make the actual CORS request to get patient data
// patient_id The id of the patient
function requestPatient(patient_id) {	  
  jsonResp = null;
  var url = 'http://tutsgnfhir.com/Patient/' + patient_id + '$everything?_format=json';

  var xhr = createCORSRequest('GET', url);
  if (!xhr) {
        alert('CORS not supported');
        return;
  }

  // Response handlers.
  xhr.onload = function() {
        //var text = xhr.responseText;
        var jsonResp = JSON.parse(xhr.responseText);

        // print json in text format
        //console.log(xhr.responseText);
        // print json object
        console.log(jsonResp);
        var msg = "";
        if (jsonResp.total !== 0)
        {
            // Get resource types
            var _patient = getResourceType(jsonResp, "Patient", null);
            console.log(_patient);
            var _bmi = getResourceType(jsonResp, "Observation", ["39156-5"]);
            console.log(_bmi);
            var _glucose = getResourceType(jsonResp, "Observation", ["2339-0","1558-6","2345-7"]);
            var _pressure = getResourceType(jsonResp, "Observation", ["55284-4"]);
            var _cholesterol = getResourceType(jsonResp, "Observation", ["2093-3"]);
            var _tobacco = getResourceType(jsonResp, "Observation", ["72166-2"]);
            var _diabetis = getResourceType(jsonResp, "Condition", ["44054006", "190372001"]);
            
            var overallRisk = [];
            var bmiRisk = getRisk(_bmi, "bmi", "last", "");
            overallRisk.push(bmiRisk);
            var glucoseRisk = getRisk(_glucose, "glucose", "last", _diabetis);
            overallRisk.push(glucoseRisk);
            var cholesterolRisk = getRisk(_cholesterol, "cholesterol", "last", "");
            overallRisk.push(cholesterolRisk);
            var smokingRisk = getRisk(_tobacco, "smoking", "last", "");
            overallRisk.push(smokingRisk);
            var bloodPressureRisk = getRisk(_pressure, "bloodPressure", "last", "");
            overallRisk.push(bloodPressureRisk);
            
            //output patient data
            displayData(_patient, "patientname", "", "");
            displayData("", "overall", "", analyseRisk(overallRisk));
            displayData(_bmi, "bmi", "last", bmiRisk);
            displayData(_glucose, "glucose", "last", glucoseRisk);
            displayData(_pressure, "systolic", "last", bloodPressureRisk);
            displayData(_pressure, "diastolic", "last", bloodPressureRisk);
            displayData(_cholesterol, "cholesterol", "last", cholesterolRisk);
            displayData(_tobacco, "smoking", "last", smokingRisk);
        }
        else
        {
            msg = 'Patient with id ' + patient_id + ' not found.';            
            //alert(msg);
        }
        document.getElementById("errorText").innerHTML = msg;
  };

  xhr.onerror = function() {
        alert('Woops, there was an error making the request.');
  };

  xhr.send();
}

// Gets data (name, observation values) from given resource object and sets it to the given document element for display
// resource     The resource type data
// elementId    The id of the display element
// position     first|last occurrence of the observation
// risk         Risk of the resource
function displayData(resource, elementId, position, risk) {
    // overwrite element for previous data
    document.getElementById(elementId).innerHTML = "";
    try {
        switch (elementId) {
            case "patientname":
                var secondName = ' ' + resource[0].name[0].given[1];
                if (secondName === " undefined") {
                    secondName = "";
                }
                document.getElementById(elementId).innerHTML = resource[0].name[0].family[0] + ', ' + resource[0].name[0].given[0] + secondName + ' ' + getFinDate(resource[0].birthDate) + ' Patient ID: ' + resource[0].id;
                break;
            case "bmi":
            case "cholesterol":
            case "glucose":
                if (position === "first") {
                    document.getElementById(elementId).innerHTML = resource[0].code.text + ': ' + resource[0].valueQuantity.value + ' ' + resource[0].valueQuantity.unit + ', Risk evaluation: ' + risk;
                }
                else {
                    // gets last occurrence of resource observation
                    document.getElementById(elementId).innerHTML = resource[resource.length-1].code.text + ': ' + resource[resource.length-1].valueQuantity.value + ' ' + resource[resource.length-1].valueQuantity.unit + ', Risk evaluation: ' + risk;
                }
                break;
            case "systolic":
            case "diastolic":
                // set component position of systolic
                var compoPos = 0;
                if (elementId === "diastolic") {
                    compoPos = 1;
                }
                if (position === "first") {
                    document.getElementById(elementId).innerHTML = resource[0].component[compoPos].code.text + ': ' + resource[0].component[compoPos].valueQuantity.value + ' ' + resource[0].component[compoPos].valueQuantity.unit + ', Risk evaluation: ' + risk;
                }
                else {
                    // gets last occurrence of resource observation
                    document.getElementById(elementId).innerHTML = resource[resource.length-1].component[compoPos].code.text + ': ' + resource[resource.length-1].component[compoPos].valueQuantity.value + ' ' + resource[resource.length-1].component[compoPos].valueQuantity.unit + ', Risk evaluation: ' + risk;
                }
                break;
            case "smoking":
                if (position === "first") {
                    // Note the time format 
                    document.getElementById(elementId).innerHTML = resource[0].code.text + ': ' + resource[0].valueCodeableConcept.text + ', Risk evaluation: ' + risk;
                }
                else {
                    // gets last occurrence of resource observation
                    document.getElementById(elementId).innerHTML = resource[resource.length-1].code.text + ': ' + resource[resource.length-1].valueCodeableConcept.text + ', Risk evaluation: ' + risk;
                }
                break;
            case "overall":
                document.getElementById(elementId).innerHTML = "Overall risk analysis: " + risk;
                break;
        }
    }
    catch(err) {
        console.log("No observation for " + elementId);
    }
}

// Get risk for given resource
// Returns risk condition code ("normal"|"treatment"|"borderline"|"high") or "unknown" if not found
// resource     The resource type data
// riskId       The id of risk
// position     first|last occurrence of the observation
// condition    The patient may have a condition which effects risk evaluation like diabetis
function getRisk(resource, riskId, position, condition) {
    var resPos = 0;
    if (position === "last") {
        resPos = resource.length-1;
    }
    try {
        switch (riskId) {
            case "bmi":
                var bmi = parseFloat(resource[resPos].valueQuantity.value);
                if (bmi < 18.5) {
                    return "borderline";
                }
                else if (bmi >= 18.5 && bmi < 25) {
                    return "normal";
                }
                else if (bmi >= 25 && bmi < 30) {
                    return "borderline";
                }
                else {
                    return "high";
                }
                break;
            case "cholesterol":
                var risk = "";
                try {
                    risk = resource[resPos].referenceRange[0].meaning.coding[0].code;
                    return risk;
                }
                catch(err){
                }
                if (risk === "") {
                    var obsValue = parseFloat(resource[resPos].valueQuantity.value);
                    if (obsValue < 200) {
                        return "normal";
                    } else if (obsValue > 199 || obsValue < 240) {
                        return "borderline";
                    }
                    else {
                        return "high";
                    }
                }
                break;
            case "glucose":
                var risk = "";
                try {
                    risk = resource[resPos].referenceRange[0].meaning.coding[0].code;
                    return risk;
                }
                catch(err){
                }
                if (risk === "") {
                    var obsValue = parseFloat(resource[resPos].valueQuantity.value);
                    var code = resource[resPos].code.coding[0].code;
                    if (condition.length !== 0) {     // diabetic
                        switch (code) {
                            // fasting value
                            case "1558-6":
                                if (obsValue > 79 || obsValue < 131) {
                                    return "normal";
                                }
                                else {
                                    return "high";
                                }
                                break;
                            case "2339-0":
                            case "2345-7":
                                if (obsValue < 181) {
                                    return "normal";
                                }
                                else {
                                    return "high";
                                }
                                break;
                        }
                    }
                    else {                      // non-diabetic
                        switch (code) {
                            // fasting value
                            case "1558-6":
                                if (obsValue > 69 || obsValue < 100) {
                                    return "normal";
                                }
                                else {
                                    return "high";
                                }
                                break;
                            case "2339-0":
                            case "2345-7":
                                if (obsValue < 141) {
                                    return "normal";
                                }
                                else {
                                    return "high";
                                }
                                break;
                        }
                    }
                }
                break;
            case "smoking":
                var code = resource[resPos].valueCodeableConcept.coding[0].code;
                switch (code) {
                    case "449868002":
                        return "high"; break;
                    case "428041000124106":
                        return "borderline"; break;
                    case "8517006":
                        return "borderline"; break;
                    case "266919005":
                        return "normal"; break;
                    case "77176002":
                        return "borderline"; break;
                    case "266927001":
                        return "normal"; break;
                    case "428071000124103":
                        return "high"; break;
                    case "428061000124105:":
                        return "high"; break;
                    default:
                        return "unknown"; break;
                }
                break;
            case "bloodPressure":
                var systolic = parseFloat(resource[resPos].component[0].valueQuantity.value);
                var diastolic = parseFloat(resource[resPos].component[1].valueQuantity.value);
                if (systolic > 180 || diastolic > 110) {
                    return "high";
                }
                else if (systolic > 159 || diastolic > 99) {
                    return "high";
                }
                else if (systolic > 139 || diastolic > 89) {
                    return "high";
                }
                else if (systolic > 119 || diastolic > 79) {
                    return "borderline";
                }
                else if (systolic < 120 || diastolic < 80) {
                    return "normal";
                }
                break;
            default:
                return "unknown"; break;
        }
    }
    catch(err){
        console.log("Risk could not be analysed for " + riskId);
    }
    return "unknown";
}

// Get risk for given resource
// Returns overall risk analysis ("normal"|"moderate"|"high") or "unknown"
// riskArr     Array of individual risks
function analyseRisk(riskArr) {
    if (riskArr.length === 0) {
        return "unknown";
    }
    var overallRisk = 0;
    for (var i = 0; i < riskArr.length; i++) {
        if (riskArr[i] === "high" || riskArr[i] === "borderline" || riskArr[i] === "treatment") {
            overallRisk++;
        }
    }
    if (overallRisk > 4) {
        return "high";
    }
    else if (overallRisk > 1) {
        return "moderate";
    }
    else
        return "normal";
}

// Gets resource types e.g. Patient and Observation. For Observation the codes are provided to specify the exact observation
function getResourceType(jsonArr, resType, codes)
{
    var resource = [];
    for(var i = 0; i < jsonArr.entry.length; i++)
    {
        // Resource type Patient has no code
        if (codes === null) {
            if(jsonArr.entry[i].resource.resourceType === resType)
            {
                resource.push(jsonArr.entry[i].resource);
            }
        }
        else {
            // Tries to get the observation with given codes
            try {
                if(jsonArr.entry[i].resource.resourceType === resType && jsonArr.entry[i].resource.code.coding[0].code !== null)
                {
                    for (var j = 0; j < codes.length; j++) {
                        try {
                            if (jsonArr.entry[i].resource.code.coding[0].code === codes[j]) {
                                resource.push(jsonArr.entry[i].resource);
                            }
                        }
                        catch(err){                            
                        }
                    }
                }
            }
            catch(err){
            }
        }
    }
    return resource;
}

// gets Finnish date string from fhir date
function getFinDate(strDate) {
    var dateParts = strDate.split("-");
    var date = new Date(dateParts[0], dateParts[1], dateParts[2]);
    return (date.getDate() + "." + date.getMonth() + "." + date.getFullYear());
}

// Get url query parameters
function getQueryParams(qs) {
    qs = qs.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params;
}

//start when the window has loaded
window.onload = function(){
    var query = getQueryParams(document.location.search);
    if (query.patientId !== null)
    {
        document.getElementById("formPatientId").value = query.patientId;
        requestPatient(query.patientId);
    }
    // request patient data with submitted patientId (formData/patientId)
    document.getElementById('submitId').onclick = function(e){
        var formData = new FormData(document.querySelector('form'));
        requestPatient(formData.get('patientId'));
        return false;
    };
};
