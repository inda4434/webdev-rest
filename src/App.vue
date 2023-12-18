<script setup>
import { reactive, ref, onMounted } from 'vue'

let crime_url = ref('');
let location_input = ref('');
let dialog_err = ref(false);
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
            let lat = console.log(data[0].lat);
            let lon = console.log(data[0].lon);

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

        map.leaflet.flyTo(new L.LatLng(lat, lon));

        console.log(lat, lon, 8);
    })
}

// Function called once user has entered REST API URL
function initializeCrimes() {
    // TODO: get code and neighborhood data
    //       get initial 1000 crimes
}

// Function called when user presses 'OK' on dialog box
function closeDialog() {
    let dialog = document.getElementById('rest-dialog');
    let url_input = document.getElementById('dialog-url');
    updateMapLocation(url_input.value);
    if (crime_url.value != '' && url_input.checkValidity()) {
        dialog_err.value = false;
        dialog.close();
        initializeCrimes();
    } else {
        dialog_err.value = true;
    }
}

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
        <input id="location" class="dialog-input" type="text" v-model="location_input" placeholder="http://localhost:8000"/>
        <br/>
        <button class="button" type="button" @click="updateMapLocation">Go</button>
    </dialog>

    
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
