<script setup>
import { reactive, ref, onMounted } from 'vue';


let crime_url = ref('');
let location_input = ref('');
let dialog_err = ref(false);
let crimes = ref([]);
let map = reactive(
    {
        leaflet: null,
        center: {
            lat: 44.955139,
            lng: -93.102222,
            address: ''
        },
        zoom: 12,
        bounds: {
            nw: {lat: 45.008206, lng: -93.217977},
            se: {lat: 44.883658, lng: -92.993787}
        },
        neighborhood_markers: [
            {location: [44.942068, -93.020521], marker: null},
            {location: [44.977413, -93.025156], marker: null},
            {location: [44.931244, -93.079578], marker: null},
            {location: [44.956192, -93.060189], marker: null},
            {location: [44.978883, -93.068163], marker: null},
            {location: [44.975766, -93.113887], marker: null},
            {location: [44.959639, -93.121271], marker: null},
            {location: [44.947700, -93.128505], marker: null},
            {location: [44.930276, -93.119911], marker: null},
            {location: [44.982752, -93.147910], marker: null},
            {location: [44.963631, -93.167548], marker: null},
            {location: [44.973971, -93.197965], marker: null},
            {location: [44.949043, -93.178261], marker: null},
            {location: [44.934848, -93.176736], marker: null},
            {location: [44.913106, -93.170779], marker: null},
            {location: [44.937705, -93.136997], marker: null},
            {location: [44.949203, -93.093739], marker: null}
        ]
    }
);

// Vue callback for once <template> HTML has been added to web page
onMounted(() => {
    // Create Leaflet map (set bounds and valied zoom levels)
    map.leaflet = L.map('leafletmap').setView([map.center.lat, map.center.lng], map.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 11,
        maxZoom: 18
    }).addTo(map.leaflet);
    map.leaflet.setMaxBounds([[44.883658, -93.217977], [45.008206, -92.993787]]);
    

    map.leaflet.on('moveend', onMapMoveEnd);

    // Get boundaries for St. Paul neighborhoods
    let district_boundary = new L.geoJson();
    district_boundary.addTo(map.leaflet);
    fetch('data/StPaulDistrictCouncil.geojson')
    .then((response) => {
        return response.json();
    })
    .then((result) => {
        result.features.forEach((value) => {
            district_boundary.addData(value);
        });
    })
    .catch((error) => {
        console.log('Error:', error);
    });
});




// FUNCTIONS
function onMapMoveEnd(e) {
    let input = document.getElementById('location');
    let center = e.target.getCenter();
    input.value = "(" + center.lat + ", " + center.lng + ")";
}

function updateMapLocation() {
    let input = document.getElementById('location').value;
    console.log(input);
    let up = new Promise((resolve, reject) => {
        if (input[0] == '(' && input[input.length - 1] == ')') {
        let coords = input.split(",");
        let lat = parseFloat(coords[0].replace("(", "").replace(" ", ""));
        let lon = parseFloat(coords[1].replace(")", ""));
        
        if (isNaN(lat) || isNaN(lon)) {
            reject();
        }

        resolve({lat, lon});
    } else {
        fetch('https://nominatim.openstreetmap.org/search?q=' + input + '&format=json&limit=1').then((res) => {
        res.json().then((data) => {
            let lat = data[0].lat;
            let lon = data[0].lon;

            if (typeof(lat) === 'undefined') {
                reject();
            }
            resolve({lat, lon});
            });
        });
    }});

    up.then((data) => {
        let lat = data.lat;
        let lon = data.lon;

        lat = Math.min(map.bounds.nw.lat, lat);
        lat = Math.max(map.bounds.se.lat, lat);
        lon = Math.max(map.bounds.nw.lng, lon);
        lon = Math.min(map.bounds.se.lng, lon);

        map.leaflet.flyTo(new L.LatLng(lat, lon), 18);

        console.log(lat, lon);
    })
}

// Function to fetch neighborhood name for a single crime
function fetchNeighborhoodNameForCrime(crime) {
    return fetch(crime_url.value + '/neighborhoods?id=' + crime.neighborhood_number)
        .then(response => response.json())
        .then((data) => {
            crime.neighborhood_name = data[0] ? data[0].neighborhood_name : 'Unknown Neighborhood';
        })
        .catch((err) => {
            console.log("Error fetching neighborhood name: " + err);
            crime.neighborhood_name = 'Unknown Neighborhood';
        });
}

// Function to fetch incident type for a single crime
function fetchIncidentTypeForCrime(crime) {
    return fetch(crime_url.value + '/codes?code=' + crime.code)
        .then(response => response.json())
        .then((data) => {
            crime.incident_type = data[0] ? data[0].incident_type : 'Unknown Incident Type';
        })
        .catch((err) => {
            console.log("Error fetching incident type: " + err);
            crime.incident_type = 'Unknown Incident Type';
        });
}

// Function called once user has entered REST API URL
function initializeCrimes() {
    fetch(crime_url.value + '/incidents')
        .then(response => response.json())
        .then(data => {
            crimes.value = data;
            console.log(crimes.value);

            const fetchNeighborhoodPromises = crimes.value.map(crime => fetchNeighborhoodNameForCrime(crime));
            const fetchIncidentTypePromises = crimes.value.map(crime => fetchIncidentTypeForCrime(crime));

            Promise.all([...fetchNeighborhoodPromises, ...fetchIncidentTypePromises])
                .then(() => {
                    console.log(crimes.value);
                    addMarkersToMap();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
});
}


// Function called when user presses 'OK' on dialog box
function closeDialog() {
    let dialog = document.getElementById('rest-dialog');
    let url_input = document.getElementById('dialog-url');
    //updateMapLocation(url_input.value);
    if (crime_url.value != '' && url_input.checkValidity()) {
        dialog_err.value = false;
        dialog.close();
        initializeCrimes();
    } else {
        dialog_err.value = true;
    }
}

/// Function to get crime counts for each neighborhood
function calculateCrimeCounts() {
    const neighborhoodCounts = {};

    crimes.value.forEach((crime) => {
        const neighborhoodName = crime.neighborhood_name || 'Unknown Neighborhood';

        if (!neighborhoodCounts[neighborhoodName]) {
            neighborhoodCounts[neighborhoodName] = 1;
        } else {
            neighborhoodCounts[neighborhoodName]++;
        }
    });

    return neighborhoodCounts;
}

// Function to add markers to the map
function addMarkersToMap() {
    const neighborhoodCounts = calculateCrimeCounts();

    for (const [neighborhoodName, crimeCount] of Object.entries(neighborhoodCounts)) {
        getCoordinatesForNeighborhood(neighborhoodName).then((coordinates) => {
            const marker = L.marker(coordinates).addTo(map.leaflet);
            marker.bindPopup(`Neighborhood: ${neighborhoodName}<br>Crime Count: ${crimeCount}`);
        });
    }
}

// Function to get coordinates for a neighborhood using Nominatim API
async function getCoordinatesForNeighborhood(neighborhoodName) {
    const nominatimApiUrl = 'https://nominatim.openstreetmap.org/search';
    const params = {
        q: neighborhoodName,
        format: 'json',
    };

    try {
        const response = await fetch(`${nominatimApiUrl}?${new URLSearchParams(params)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
    } catch (error) {
        console.error('Error fetching coordinates:', error);
    }

    return [0, 0];
}

onMounted(async () => {
    await initializeCrimes();
    await new Promise(resolve => map.leaflet.whenReady(resolve));
    addMarkersToMap();
});


const newIncident = ref({
    case_number: '',
    date: '',
    time: '',
    code: '',
    incident: '',
    police_grid: '',
    neighborhood_number: '',
    block: ''
});

function newIncidentFunc(){
    fetch(`${crime_url.value}/new-incident`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newIncidentFunc.value),
    })
    .then (response => {
        if (response.ok){
            console.log('new form added');
            newIncidentFunc.value = {
                case_number: '',
                date: '',
                time: '',
                code: '',
                incident: '',
                police_grid: '',
                neighborhood_number: '',
                block: ''
            };
        }
        else {
            console.log('sucks');
        }
    })
    .catch(err =>{
        console.log(err)
    });
}

</script>

<template>
    <dialog id="rest-dialog" open>
        <h1 class="dialog-header">St. Paul Crime REST API</h1>
        <label class="dialog-label">URL: </label>
        <input id="dialog-url" class="dialog-input" type="url" v-model="crime_url" placeholder="http://localhost:8000"/>
        <p class="dialog-error" v-if="dialog_err">Error: must enter valid URL</p>
        <br/>
        <button class="button" type="button" @click="closeDialog">OK</button>
    </dialog>

    <div class="grid-container ">
        <div class="grid-x grid-padding-x">
            <div id="leafletmap" class="cell auto"></div>
        </div>
    </div>

    <dialog id="location-dialog" open>
        <label class="location-label">Location: </label>
        <input id="location" class="dialog-input" type="text" v-model="location_input" placeholder="Enter location"/>
        <br/>
        <button class="button" type="button" @click="updateMapLocation">Go</button>
    </dialog>
    <div v-if="crimes.length > 0" class="grid-x grid-padding-x">
        <table>
            <thead>
                <tr>
                    <th>Incident Type</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Neighborhood Name</th>
                    <th>Block</th>
                    <!--<th>Police Grid</th>-->
                </tr>
            </thead>
            <tbody>
                <tr v-for="crime in crimes.slice(0, 50)" :key="crime.case_number">
                    <td>{{ crime.incident_type }}</td>
                    <td>{{ crime.date }}</td>
                    <td>{{ crime.time }}</td>
                    <td>{{ crime.neighborhood_name }}</td>
                    <td>{{ crime.block }}</td>

                    <!--<td>{{ crime.police_grid }}</td>-->
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else>
      <p>Enter API URL to view crime data</p>
    </div>
    
    <!--NEW INCIDENT FORM-->
    <div>
        <div class="grid-x grid-padding-x">
            <h3>New Incident Form</h3>
            <div class="cell small-12 large-12">
                <form id="new-incident" action="/new-incident" method="PUT" @submit.prevent="newIncident">
                    <!--case_number-->
                    <div class="cell small-12 large-6">
                        <label for="case_number">Case Number: </label>
                        <input type="text" placeholder="Ex: 20231219" name="case_number" id="case_number" v-model="newIncident.case_number" required/>
                    </div>
                    <!--date-->
                    <div class="cell small-12 large-6">
                        <label for="date">Date: </label>
                        <input type="text" placeholder="Ex: 2023-12-19" name="date" id="date" v-model="newIncident.date" required/>
                    </div>
                    <!--time-->
                    <div class="cell small-12 large-6">
                        <label for="time">Time: </label>
                        <input type="text" placeholder="Ex: 21:59:59" name="time" id="time" v-model="newIncident.time" required/>
                    </div>
                    <!--code-->
                    <div class="cell small-12 large-6">
                        <label for="code">Code: </label>
                        <input type="text" placeholder="Ex: 9954" name="code" id="code" v-model="newIncident.code" required/>
                    </div>
                    <!--incident-->
                    <div class="cell small-12 large-6">
                        <label for="incident">Incident: </label>
                        <input type="text" placeholder="Ex: Proactive Police Visit" name="incident" id="incident" v-model="newIncident.incident" required/>
                    </div>
                    <!--police_grid-->
                    <div class="cell small-12 large-6">
                        <label for="police_grid">Police Grid: </label>
                        <input type="text" placeholder="Ex: 87" name="police_grid" id="police_grid" v-model="newIncident.police_grid" required/>
                    </div>
                    <!--neighborhood_number-->
                    <div class="cell small-12 large-6">
                        <label for="neighborhood_number">Neighborhood Number: </label>
                        <input type="text" placeholder="Ex: 7" name="neighborhood_number" id="neighborhood_number" v-model="newIncident.neighborhood_number" required/>
                    </div>
                    <!--block-->
                    <div class="cell small-12 large-6">
                        <label for="block">Block: </label>
                        <input type="text" placeholder="Ex: 98X UNIVERSITY AV W" name="block" id="block" v-model="newIncident.block" required/>
                    </div>
                    <!--submit-->
                    <div class="cell small-12 large-6">
                        <button id="sub_new_inc" type="submit">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style>
#rest-dialog {
    width: 20rem;
    margin-top: 1rem;
    z-index: 1000;
}

#leafletmap {
    height: 500px;
}

.dialog-header {
    font-size: 1.2rem;
    font-weight: bold;
}

.dialog-label {
    font-size: 1rem;
}

.dialog-input {
    font-size: 1rem;
    width: 100%;
}

.dialog-error {
    font-size: 1rem;
    color: #D32323;
}
</style>
