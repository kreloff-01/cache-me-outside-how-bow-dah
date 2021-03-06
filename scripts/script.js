var map;
var bearings = ["NE", "E", "SE", "S", "SW", "W", "NW", "N"];    // cardinal directions yo

var masterWaypoints = [];

var directionsService;
var directionsDisplay;

function initMap() {
	directionsService = new google.maps.DirectionsService;
	directionsDisplay = new google.maps.DirectionsRenderer;
	map = new google.maps.Map(document.getElementById('map'), {
		zoom: 6,
		center: {lat: 41.85, lng: -87.65}
	});
	directionsDisplay.setMap(map);

	document.getElementById('submit').addEventListener('click', function() {
		var choose = document.getElementById('choice').value;
		if (choose === "potholes") {
			calculateAndDisplayRoute(directionsService, directionsDisplay);
		} else if (choose === 'elevation') {
			chooseHill(directionsService, directionsDisplay);
		} else if (choose === 'right_turn') {
			rightRoute(directionsService, directionsDisplay);
		}

    });
}

function calculateAndDisplayRoute(directionsService, directionsDisplay) {
	var waypts = [];
	var checkboxArray = document.getElementById('waypoints');
	for (var i = 0; i < checkboxArray.length; i++) {
		if (checkboxArray.options[i].selected) {
			waypts.push({
				location: checkboxArray[i].value,
				stopover: true
			});
		}
	}

    directionsService.route({
        origin: document.getElementById('start').value,
        destination: document.getElementById('end').value,
        provideRouteAlternatives: true,
        waypoints: waypts,
        optimizeWaypoints: true,
        travelMode: 'DRIVING'
    }, function(response, status) {
        if (status === 'OK') {
            console.log("OK ENTERED");
            directionsDisplay.setDirections(response);
            var weights = calculateBestPath(response);
            var min = Math.min.apply(Math,weights);
            var index = weights.indexOf(min);
            console.log(index + " chosen route");
            console.log(weights + " weights final");
            var summaryPanel = document.getElementById('directions-panel');
            summaryPanel.innerHTML = '';
            var route = response.routes[index];
            // For each route, display summary information.
            for (var i = 0; i < route.legs.length; i++) {
            	var routeSegment = i + 1;
            	summaryPanel.innerHTML += '<b>Route Segment: ' + routeSegment +
            	'</b><br>';
            	summaryPanel.innerHTML += route.legs[i].start_address + ' to ';
            	summaryPanel.innerHTML += route.legs[i].end_address + '<br>';
            	summaryPanel.innerHTML += route.legs[i].distance.text + '<br><br>';
            }
        } else {
        	window.alert('Directions request failed due to ' + status);
        }
    });
}

async function rightRoute(directionsService, directionsDisplay) {
	// console.log("motherfucker")
	var waypts = [];
	directionsService.route({
		origin: document.getElementById('start').value,
		destination: document.getElementById('end').value,
		waypoints: waypts,
		optimizeWaypoints: true,
		travelMode: 'DRIVING'
	}, function(response, status) {
		// var takenRoute = [];
		if(status === "OK") {
			// console.log(1 + "response")
			var routes = response['routes'];
			// console.log(routes);
			for(var i = 0 ; i < routes.length; i++) {
				var route = routes[i];
				var legs = route['legs'];
				for(var j = 0; j < legs.length; j++) {
					var leg = legs[j];
					// console.log(leg)
					var steps = leg["steps"];
					// console.log(steps);
					var prevLat, prevLng;
					var prevDirection;
					var lat, lon;
					var skip = false;


					// get the individual steps for the leg of the journey
					for(var y = 0; y < steps.length; y++){
						// console.log("AGGGGGGGGG")
						// console.log(steps[y])

						lat = steps[y]['start_point'].lat()
						lon = steps[y]['start_point'].lng()

						// console.log(lat + ", " + lon)

						// if it is a left turn, do necessary changes to make it a right turn
						if(steps[y]['maneuver'] === "turn-left") {

							// console.log("OH SHIT ITS A LEFT YO")
							// console.log(steps[y])
							// console.log("LAT : " + lat)
							// console.log("LONG : " + lon)
							// the below coordinates correspond to the intersection you are taking the left on
							// console.log(lat + ", " + lon)


							// make a google lat,long object with lat/long of left turn intersection
							var pos = new google.maps.LatLng(lat, lon);

							// request for places by me
							var request = {
								location: pos,
								radius: 300
							};
							// get nearby places. async so it kinda sucks
							getNearBy(request, lat, lon, prevDirection);
                            sleep(750);



                        } else {
							// push non-left positions to the master list
                            console.log("A")
                            masterWaypoints.push(new google.maps.LatLng(lat, lon));
                        }
						// save the prev direction for future direction changes
						// helpful for determining lefts
						prevDirection = getCardinalDirection(prevLat, prevLng, lat, lon);

						prevLat = lat;
						prevLng = lon;


						if(y === 0) {
							var startLat = steps[y]['start_point'].lat();
							var startLng = steps[y]['start_point'].lng();
							prevLat = steps[y]['end_point'].lat();
							prevLng = steps[y]['end_point'].lng();
							prevDirection = getCardinalDirection(startLat, startLng, prevLat, prevLng);
						}




					}
				}
			}
		}

	});
}


// function used to get the cardinal direction giving two lat/lon points
function getCardinalDirection(lat1, lng1, lat2, lng2) {

	var lon_distance = (lng2-lng1);

						// console.log("lat1 : " + lat1 + "\nlng1 : " + lng1 + "\nlat2 : " + lat2 + "\nlng2 : " + lng2)

						var y = Math.sin(lon_distance) * Math.cos(lat2);
						var x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon_distance);
	var bearng_calc = Math.atan2(y, x) * (180/Math.PI);  // bearing

	// console.log("BEARING CALCULATION : " + bearng_calc)

	var index = bearng_calc - 22.5;


	if (index < 0)
		index += 360;
	index = parseInt(index / 45);

	return(bearings[index]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



// uses google places API in order to get nearby places of interest.
// we can use these to set another waypoint to force right turns over left
async function getNearBy(request, latitude, longitude, prevDirect) {
	// instantiate service
	var service = new google.maps.places.PlacesService(map);

	// make the search. it is async which is why we have a compound callback function
	// we need it to pass
	service.nearbySearch(request, function(results, status){
		// save variables to the scope of the callback func
		var templat = latitude;
		var templon = longitude;
		var tempPrevDirection = prevDirect;
		// make the actual callback function
		callback(results, status, templat, templon, tempPrevDirection);
        sleep(1000);
    });



	async function callback(results, status, latt, lng, tempPrevDirection) {
								// array of possible waypoints to keep
								var keep = [];
								if (status == google.maps.places.PlacesServiceStatus.OK) {

									// iterate through the results testing if they require a left turn
									for (var l = 0; l < results.length; l++) {

										// console.log(results[l])
										console.log("... Calculating the direction to location ...");
										var tempLat = results[l]['geometry']['location'].lat();
										var tempLng = results[l]['geometry']['location'].lng();

										var tempDirection = getCardinalDirection(tempLat, tempLng, latt, lng);





										/* the following section determines if you are taking a left or right turn based on the change in cardinal directions */
										var indexOfPrevDirect = bearings.indexOf(tempPrevDirection);
										var indexOfTempDirect;
										if(indexOfPrevDirect > 4) {
											var temp = 4;
											for(var q = 0; q < bearings.length; q++) {
												if(bearings[q] === tempPrevDirection) {
													break;
												}
												temp++;
											}
											indexOfTempDirect = temp;
										} else {
											indexOfTempDirect = bearings.indexOf(tempDirection);
										}
										/* end of section */


										// console.log(indexOfPrevDirect + " ::: " + indexOfTempDirect)

										// if it is not a left turn, add it to the list of possible waypoints
										if(indexOfTempDirect - indexOfPrevDirect <= 3 && indexOfTempDirect - indexOfPrevDirect >= 0) {
											// console.log("should be a right turn");
											// console.log("DIRECTION for left turn\nPrevDirection --> directionOfHotspot")
											// console.log(tempPrevDirection + " --> " + tempDirection)
											keep.push(results[l]);

										}

									// // createMarker(results[i]);
								}
							}

							// get a lat/lon position for current pos
							var pos = new google.maps.LatLng(latt, lng);
							var bestWaypoint = null;
							// initialize service
							var service = new google.maps.DistanceMatrixService();
							// iterate through the keep and calculate distance


							for(var i = 0; i < keep.length; i++) {
                                // if(i > 0) {
                                //     await sleep(6000);
                                // }
								// temp lat/lon variable for calculation
								var tempdest = new google.maps.LatLng(keep[i]['geometry']['location'].lat(), keep[i]['geometry']['location'].lng());
								// request the distance matrix from google. async
								service.getDistanceMatrix(
								{
									origins: [pos],
									destinations: [tempdest],
									travelMode: 'DRIVING',
								}, function(response, status){
									// another compound callback function to pass the possible waypoint the scope of the
									// callback before overwritting
									var tempDestination = tempdest;
									// perform callback
									callbackThree(response, status, tempDestination);
                                    // await sleep(650)
                                });

                                // await sleep(3000)
                                function callbackThree(response, status, destination) {
                                    // sleep(500);
									// distance
                                    // console.log("AGH")
									// console.log(response['rows'][0]['elements'][0]['distance']);
									// if the distance is smallest, push to master waypoints.
									// however there are issues here do to the async nature of the calls.
									if( response['rows'][0]['elements'][0]['distance']['value'] < bestWaypoint || bestWaypoint === null) {
										bestWaypoint = response['rows'][0]['elements'][0]['distance']['value'];
										masterWaypoints.push(destination);    /// this is most likely wrong.
									}

                                    console.log(masterWaypoints);


                                    var waypts = [];

                                    for(var i = 1; i < masterWaypoints.length - 1; i++) {
                                        waypts.push({
                                            location: new google.maps.LatLng(masterWaypoints[i].lat(), masterWaypoints[i].lng()),
                                            stopover: true
                                        });
                                    }

                                    console.log(waypts)

                                    directionsService.route({
                                        origin: new google.maps.LatLng(masterWaypoints[0].lat(), masterWaypoints[0].lng()),
                                        destination: new google.maps.LatLng(masterWaypoints[masterWaypoints.length-1].lat(), masterWaypoints[masterWaypoints.length-1].lng()),
                                        provideRouteAlternatives: false,
                                        waypoints: waypts,
                                        optimizeWaypoints: false,
                                        travelMode: 'DRIVING'
                                    }, function(response, status) {
                                        if (status === 'OK') {
                                            console.log("OK ENTERED");
                                            directionsDisplay.setDirections(response);
                                            var weights = calculateBestPath(response);
                                            var min = Math.min.apply(Math,weights);
                                            var index = weights.indexOf(min);
                                            console.log(index + " chosen route");
                                            console.log(weights + " weights final");
                                            var summaryPanel = document.getElementById('directions-panel');
                                            summaryPanel.innerHTML = '';
                                            var route = response.routes[index];
            // For each route, display summary information.
            for (var i = 0; i < route.legs.length; i++) {
                var routeSegment = i + 1;
                summaryPanel.innerHTML += '<b>Route Segment: ' + routeSegment +
                '</b><br>';
                summaryPanel.innerHTML += route.legs[i].start_address + ' to ';
                summaryPanel.innerHTML += route.legs[i].end_address + '<br>';
                summaryPanel.innerHTML += route.legs[i].distance.text + '<br><br>';
            }
        } else {
            window.alert('Directions request failed due to ' + status);
        }
    });


                                }
                                // sleep(1200);


                            }
                            // await sleep(5000);
                            // console.log("last?");

                        }
                        // console.log("last?");
                    }
