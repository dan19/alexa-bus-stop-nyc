var https = require('https');
var queryString = require('querystring');
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var TABLE_NAME = "BusNYC_User";
var STAGE_SETUP_STOP_NUMBER = 1;
var STAGE_STOP_NUMBER_SET = 2;

exports.handler = function (event, context)
{
    var requestType = event.request.type;
    var intentName = event.request.intent ? event.request.intent.name : null;
    var slots = event.request.intent ? event.request.intent.slots : null;

    var response = {};
    response.version = "1.0";
    response.response = {};
    response.response.outputSpeech = {};
    response.response.outputSpeech.type = "PlainText";
    response.response.outputSpeech.text = "Sorry, I cannot understand your request.";
    response.response.shouldEndSession = true;

    if (requestType == "LaunchRequest") {

        onLaunchEvent(context, event, response);

    } else if (intentName == "GetBusArrivalTime" || (event.session.attributes && event.session.attributes.stage === STAGE_STOP_NUMBER_SET)) {

        onGetBusArrivalTime(context, event, response, slots);

    } else if (intentName == "AddBusStop") {

        onAddBusStopEvent(context, event, response, slots);

    } else {

        context.succeed(response);
    }
};

function onLaunchEvent(context, event, response)
{
    response.response.outputSpeech.text = "Welcome to bus N Y C, What is your bus stop number?";
    response.response.shouldEndSession = false;
    response.sessionAttributes = {};
    response.sessionAttributes.stage = STAGE_SETUP_STOP_NUMBER;
    context.succeed(response);
}

function onAddBusStopEvent(context, event, response, slots)
{
    var busStop = slots.BusStop.value;
    busStop = busStop.replace(/\s/g, '');

    if (!busStop.match(/\d+/)) {
        response.response.outputSpeech.text = "Sorry this bus number is not valid. What is your bus number?";
        response.response.shouldEndSession = false;
        context.succeed(response);

        return;
    }

    saveDataToDB(event.session, "busStop", busStop, function()
    {
        var stage = event.session.attributes && event.session.attributes.stage ? event.session.attributes.stage : "nothing";
        response.response.outputSpeech.text = "OK";
        if (event.session.attributes && event.session.attributes.stage === STAGE_SETUP_STOP_NUMBER) {
            response.sessionAttributes = {};
            response.sessionAttributes.stage = STAGE_STOP_NUMBER_SET;
            response.response.outputSpeech.text = "OK. What bus are you looking for?";
            response.response.shouldEndSession = false;
        }

        context.succeed(response);
    });
}

function onGetBusArrivalTime(context, event, response, slots)
{
    var busName = slots.BusName.value;
    busName = busName.replace(/\s/g, '');

    getDataFromDB(event.session, "busStop", function(data)
    {
        if (!data) {
            response.response.outputSpeech.text = "Sorry, You didn't setup your bus stop number. What is your bus stop number?";
            response.response.shouldEndSession = false;
            response.sessionAttributes = {};
            response.sessionAttributes.stage = STAGE_STOP_NUMBER_SET;
            context.succeed(response);
        }
        getBusArrivalTime(data, busName, function (text)
        {
            response.response.outputSpeech.text = text;
            response.sessionAttributes = {};
            context.succeed(response);
        });
    });
}

function getBusArrivalTime(busStop, busLine, completedCallback)
{
    var params = {};
    params.key = "3b660b93-3bf7-4931-b732-6edcf09eb2d2";
    params.OperatorRef = "MTA";
    params.MonitoringRef = busStop;
    params.LineRef = "MTA NYCT_"+busLine;

    var query = queryString.stringify(params);
    console.log("query", query);

    var options = {
        host: 'bustime.mta.info',
        path: '/api/siri/stop-monitoring.json?'+query,
        port: 443,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': 0
        }
    };

    // Setup the HTTP request
    var req = https.request(options, function (res)
    {
        res.setEncoding('utf-8');

        // Collect response data as it comes back.
        var responseString = '';
        res.on('data', function (data)
        {
            responseString += data;
        });

        res.on('end', function ()
        {
            var jsonResponse = JSON.parse(responseString);
            var text = getBusArrivalText(jsonResponse, busLine);

            completedCallback(text);
        });
    });

    req.on('error', function (e)
    {
        console.error('HTTP error: ' + e.message);
        completedCallback('I can not understand your request for the bus '+busLine);
    });

    req.write("");
    req.end();
}

function getBusArrivalText(jsonResponse, busLine)
{
    var text = "Sorry, I cannot find any information about the "+busLine;
    var visits = jsonResponse.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    if (typeof visits != 'undefined' && visits.length > 0) {
        text = "The next "+busLine+" is:";
        var limit = visits.length > 3 ? 3 : visits.length;
        for (var i = 0; i < limit; i++)  {
            var visit = visits[i];
            var journey = visit.MonitoredVehicleJourney.MonitoredCall;
            var arrivalTime = new Date(journey.ExpectedArrivalTime);
            var stopsFrom = journey.Extensions.Distances.StopsFromCall;
            if (i > 0) {
                text += i == (limit - 1) ? " and" : ",";
            }
            if (stopsFrom <= 3) {
                text += " "+stopsFrom+" stops";
            } else {
                var minutes = getMinutesDiff(arrivalTime);
                text += " "+minutes+" minutes";
            }
        }
        text += " away.";
    }

    return text;
}

function getMinutesDiff(date)
{
    var now = new Date();
    var difference_ms = date.getTime() - now.getTime();

    return Math.floor(difference_ms / (60 * 1000));
}

function saveDataToDB(session, key, value, callback)
{
    var item = {
        TableName: TABLE_NAME,
        Item: {
            userId: {
                S: session.user.userId
            }
        }
    };
    item.Item[key] = {
        S: value
    };

    dynamodb.putItem(item, function (err, data)
    {
        if (err) {
            console.log(err, err.stack);
        }
        if (callback) {
            callback();
        }
    });
}

function getDataFromDB(session, key, callback)
{
    var item = {
        TableName: TABLE_NAME,
        Key: {
            userId: {
                S: session.user.userId
            }
        }
    };

    dynamodb.getItem(item, function (err, data)
    {
        if (err) {
            callback(null);
        } else if (data.Item === undefined) {
            callback(null);
        } else {
            var dbData = data.Item[key].S;
            callback(dbData);
        }
    });
}
