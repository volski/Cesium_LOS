window.onload = async function () {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4MTBmYmZhYy1hZjIxLTRkZmEtOTc0Yi03MDhmZDJiZmVkMDgiLCJpZCI6MjE3OTIwLCJpYXQiOjE3MTY3NjM5MzV9.XgLe77AHiep8xfRIUEtG9uqsTICLIV7005hTPDDxM5Y';

    const viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: await Cesium.createWorldTerrainAsync(),
        navigationHelpButton: false, // Disable the default navigation help button
        animation: false,            // Disable animation controls
        timeline: false,              // Disable timeline controls
        sceneModePicker: false, // Disable the default 3D toggle button
        geocoder: false,
        baseLayerPicker: false // Disable the default Bing Maps aerial button
    });

    let startLat = 32.5;
    let startLon = 34.75;
    let endLat = 32.1;
    let endLon = 34.2;
    const distanceInterval = 200; // Distance in meters

    let startPoint, endPoint;
    const entities = viewer.entities;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const facilityUrl = "../images/facility.gif";

    function createDraggablePoint(lat, lon, color, label) {
        return entities.add({
            name: label,
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            point: {
                pixelSize: 10,
                color: color,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: label,
                font: '14pt sans-serif',
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                eyeOffset: new Cesium.Cartesian3(0, 0, -10)
            },
            billboard: {
                image: facilityUrl,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            draggable: true
        });
    }

    function updatePointPosition(entity, cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        entity.position = cartesian;
        entity.label.text = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4) + ', ' + Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
        return cartographic;
    }

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radius of the Earth in meters
        const toRadians = Math.PI / 180;
        const dLat = (lat2 - lat1) * toRadians;
        const dLon = (lon2 - lon1) * toRadians;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function interpolatePoints(lat1, lon1, lat2, lon2, distance) {
        const totalDistance = haversine(lat1, lon1, lat2, lon2);
        if (totalDistance < distance) {
            alert("error");
        }
        else {
            const numPoints = Math.floor(totalDistance / distance);
            const points = [];

            for (let i = 0; i <= numPoints; i++) {
                const fraction = i / numPoints;
                const lat = lat1 + (lat2 - lat1) * fraction;
                const lon = lon1 + (lon2 - lon1) * fraction;
                points.push({ lat, lon });
            }

            return points;
        }

    }

    async function getElevationData(points) {
        const terrainProvider = viewer.terrainProvider;
        const positions = points.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat));
        const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
        updatedPositions.forEach((position, index) => {
            points[index].elevation = position.height;
        });
        return points;
    }

    function fresnelRadius(d1, d2, wavelength) {
        return Math.sqrt((wavelength * d1 * d2) / (d1 + d2));
    }

    async function checkLineOfSightAndDraw(lat1, lon1, lat2, lon2, distanceInterval) {
        entities.removeAll();

        startPoint = createDraggablePoint(lat1, lon1, Cesium.Color.BLUE, "Start");
        endPoint = createDraggablePoint(lat2, lon2, Cesium.Color.RED, "End");

        const points = interpolatePoints(lat1, lon1, lat2, lon2, distanceInterval);
        const pointsWithElevation = await getElevationData(points);

        const startElevation = pointsWithElevation[0].elevation;
        const endElevation = pointsWithElevation[pointsWithElevation.length - 1].elevation;
        const totalDistance = haversine(lat1, lon1, lat2, lon2);
        const frequency = 2.4e9; // Frequency in Hz (example for 2.4 GHz)
        const wavelength = 3e8 / frequency;

        let isClear = true;

        for (let i = 0; i < pointsWithElevation.length; i++) {
            const point = pointsWithElevation[i];
            const distanceFromStart = (i / (pointsWithElevation.length - 1)) * totalDistance;
            const expectedElevation = startElevation + (endElevation - startElevation) * (distanceFromStart / totalDistance);
            const radius = fresnelRadius(distanceFromStart, totalDistance - distanceFromStart, wavelength);

            if (point.elevation > expectedElevation + radius) {
                isClear = false;
                break;
            }
            /*
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.elevation),
                label: {
                    text: point.elevation.toFixed(2) + ' m',
                    font: '14pt sans-serif',
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                point: {
                    pixelSize: 5,
                    color: Cesium.Color.YELLOW,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
            */
            //if(isClear){
            //addHeightMarker(Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.elevation), point.elevation);
            //}
        }

        //console.log("Line of Sight:", isClear ? "Clear" : "Blocked");
        // Update the HTML element with the result
        const resultElement = document.getElementById('lineOfSightResult');
        resultElement.textContent = "Line of Sight: " + (isClear ? "Clear" : "Blocked");

        const positions = pointsWithElevation.map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.elevation));
        if (isClear) {
            // viewer.entities.add({
            //     polyline: {
            //         positions: positions,
            //         width: 2,
            //         material: Cesium.Color.BLUE
            //     }
            // });
        }


        const fresnelPositions = [];
        let revFresnelPositions = [];
        for (let i = 0; i < pointsWithElevation.length; i++) {
            const point = pointsWithElevation[i];
            const distanceFromStart = (i / (pointsWithElevation.length - 1)) * totalDistance;
            const expectedElevation = startElevation + (endElevation - startElevation) * (distanceFromStart / totalDistance);
            const radius = fresnelRadius(distanceFromStart, totalDistance - distanceFromStart, wavelength);
            fresnelPositions.push(Cesium.Cartesian3.fromDegrees(point.lon, point.lat, expectedElevation + radius));
        }
        revFresnelPositions = JSON.parse(JSON.stringify(fresnelPositions));
        if (isClear) {
            const start = Cesium.Cartesian3.fromDegrees(startLon, startLat, 100);
            const end = Cesium.Cartesian3.fromDegrees(endLon, endLat, 100);
            // createDirectedPolyline([end, start], Cesium.Color.YELLOW);
            viewer.entities.add({
                polyline: {
                    positions: fresnelPositions,
                    width: 15,
                    material: new Cesium.PolylineArrowMaterialProperty(
                        Cesium.Color.YELLOW
                    ),
                }
            });
            viewer.entities.add({
                polyline: {
                    positions: revFresnelPositions.reverse(),
                    width: 15,
                    material: new Cesium.PolylineArrowMaterialProperty(
                        Cesium.Color.LIME
                    ),
                }
            });

            //viewer.zoomTo(viewer.entities);

        }

    }
    // Function to create directed polyline with an arrowhead
function createDirectedPolyline(positions, color) {
    // Add the main polyline
    viewer.entities.add({
        polyline: {
            positions: positions,
            width: 5,
            material: color
        }
    });

    // Calculate the arrowhead position
    const arrowheadSize = 1; // Size of the arrowhead
    const startPosition = Cesium.Cartographic.fromCartesian(positions[positions.length - 2]);
    const endPosition = Cesium.Cartographic.fromCartesian(positions[positions.length - 1]);

    const direction = Cesium.Cartesian3.subtract(positions[positions.length - 1], positions[positions.length - 2], new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(direction, direction);

    const leftArrowPoint = Cesium.Cartesian3.add(positions[positions.length - 1], Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.cross(direction, new Cesium.Cartesian3(0, 0, 1), new Cesium.Cartesian3()), arrowheadSize, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const rightArrowPoint = Cesium.Cartesian3.add(positions[positions.length - 1], Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.cross(new Cesium.Cartesian3(0, 0, 1), direction, new Cesium.Cartesian3()), arrowheadSize, new Cesium.Cartesian3()), new Cesium.Cartesian3());

    // Add the arrowhead
    viewer.entities.add({
        polyline: {
            positions: [positions[positions.length - 1], leftArrowPoint, positions[positions.length - 1], rightArrowPoint],
            width: 5,
            material: color
        }
    });
}

    // Function to add height marker at a specific position
    function addHeightMarker(position, elevation) {
        // Create a height marker (label) at the clicked position with height information
        const heightMarker = viewer.entities.add({
            position: position,
            label: {
                text: elevation.toFixed(2) + ' m',
                font: '12px Arial',
                fillColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                eyeOffset: new Cesium.Cartesian3(0, 0, -10)
            }
        });

        // Remove the height marker after a delay (e.g., 5 seconds)
        setTimeout(() => {
            viewer.entities.remove(heightMarker);
        }, 5000);
    }

    // Add click event listener to the viewer
    viewer.screenSpaceEventHandler.setInputAction(function (click) {
        // Get the clicked position
        const cartesian = viewer.scene.pickPosition(click.position);
        if (cartesian) {
            // Convert the clicked position to cartographic coordinates
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            openModal(click.name, latitude, longitude, height);

            console.log('Clicked position (lon, lat, height):', longitude, latitude, height);

            // Add height marker at the clicked position
            addHeightMarker(cartesian, height);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let movingPoint = null;
    // Handle entity click event
    // handler.setInputAction(function (click) {
    //     const pickedObject = viewer.scene.pick(click.position);
    //     console.log(pickedObject);
    //     if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id) && Cesium.defined(pickedObject.id.position)) {
    //         const pickedEntity = pickedObject.id;
    //         const position = pickedEntity.position.getValue(Cesium.JulianDate.now());
    //         const cartographic = Cesium.Cartographic.fromCartesian(position);
    //         const name = pickedEntity.name;
    //         const lat = Cesium.Math.toDegrees(cartographic.latitude);
    //         const lon = Cesium.Math.toDegrees(cartographic.longitude);
    //         const height = cartographic.height;
    //         openModal(name, lat, lon, height);
    //     }
    // }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(function (movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.draggable) {
            movingPoint = pickedObject.id;
            viewer.scene.screenSpaceCameraController.enableRotate = false;
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction(function (movement) {
        if (movingPoint) {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
            if (cartesian) {
                const cartographic = updatePointPosition(movingPoint, cartesian);
                if (movingPoint === startPoint) {
                    startLat = Cesium.Math.toDegrees(cartographic.latitude);
                    startLon = Cesium.Math.toDegrees(cartographic.longitude);
                } else if (movingPoint === endPoint) {
                    endLat = Cesium.Math.toDegrees(cartographic.latitude);
                    endLon = Cesium.Math.toDegrees(cartographic.longitude);
                }
                const resultElement = document.getElementById('lineOfSightResult');
                resultElement.textContent = "Line of Sight: Checking...";
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(function () {
        if (movingPoint) {
            checkLineOfSightAndDraw(startLat, startLon, endLat, endLon, distanceInterval);
            movingPoint = null;
            viewer.scene.screenSpaceCameraController.enableRotate = true;
        }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
    // Function to zoom the viewer to fit between two locations
    function zoomBetweenLocations(lat1, lon1, lat2, lon2) {
        // Create a rectangle that encompasses the two provided positions
        const rectangle = Cesium.Rectangle.fromDegrees(
            Math.min(lon1, lon2), // west
            Math.min(lat1, lat2), // south
            Math.max(lon1, lon2), // east
            Math.max(lat1, lat2)  // north
        );

        // Fly the camera to view the computed rectangle
        viewer.camera.flyTo({
            destination: rectangle,
            duration: 3 // Animation duration in seconds
        });
    }
    // Get modal elements
    const modal = document.getElementById("myModal");
    const span = document.getElementsByClassName("close")[0];
    const entityName = document.getElementById("entityName");
    const entityLat = document.getElementById("entityLat");
    const entityLon = document.getElementById("entityLon");
    const entityHeight = document.getElementById("entityHeight");

    // Function to open modal with entity info
    function openModal(name, lat, lon, height) {
        entityName.textContent = name;
        entityLat.textContent = lat.toFixed(6);
        entityLon.textContent = lon.toFixed(6);
        entityHeight.textContent = height.toFixed(2);
        modal.style.display = "block";
    }

    // Close the modal when the user clicks on <span> (x)
    span.onclick = function () {
        modal.style.display = "none";
    }

    // Close the modal when the user clicks anywhere outside of the modal
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
    checkLineOfSightAndDraw(startLat, startLon, endLat, endLon, distanceInterval);
    zoomBetweenLocations(startLat, startLon, endLat, endLon)
}
