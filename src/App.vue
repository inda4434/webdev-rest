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

const neighborhood_names = [
    "Conway/Battlecreek/Highwood",
    "Greater East Side",
    "West Side",
    "Dayton's Bluff",
    "Payne/Phalen",
    "North End",
    "Thomas/Dale(Frogtown)",
    "Summit/University",
    "West Seventh",
    "Como",
    "Hamline/Midway",
    "St. Anthony",
    "Union Park",
    "Macalester-Groveland",
    "Highland",
    "Summit Hill",
    "Capitol River"
]

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

        let loc = document.getElementById('location-dialog');
        loc.removeAttribute('hidden');

    } else {
        dialog_err.value = true;
    }
}

// Function to get crime counts for each neighborhood
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

    for (let i = 0; i < map.neighborhood_markers.length; i++) {
        const neighborhood = map.neighborhood_markers[i];
        const count = neighborhoodCounts[neighborhood_names[i]] || 0; // Use the count from the crimeCounts

        // Set the marker content
        const popupContent = `Neighborhood: ${neighborhood_names[i]}<br>Crime Count: ${count}`;

        // Check if the marker is already created
        if (neighborhood.marker) {
            // If marker exists, update the content
            neighborhood.marker.setPopupContent(popupContent);
        } else {
            // If marker doesn't exist, create a new one
            const marker = L.marker(neighborhood.location).addTo(map.leaflet);
            marker.bindPopup(popupContent);
            neighborhood.marker = marker;
        }
    }
}

const redIcon = L.icon({
    iconUrl: 'path/to/red-marker-icon.png', // Replace with the actual path
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

const handleCrimeSelection = (crime) => {
    const address = crime.block.replace(/(\d+)X/, '$10');
    console.log(address);

    // Fetch coordinates using the Nominatim API
    getCoordinatesForAddress(address)
        .then(coordinates => {
            const crimeMarker = L.marker(coordinates, { icon: redIcon }).addTo(map.leaflet);
            const popupContent = `
                <strong>Date:</strong> ${crime.date}<br>
                <strong>Time:</strong> ${crime.time}<br>
                <strong>Incident:</strong> ${crime.incident}<br>
                <button onclick="deleteCrime('${crime.case_number}')">Delete</button>
            `;

            crimeMarker.bindPopup(popupContent).openPopup();
        })
        .catch(error => {
            console.error('Error fetching coordinates:', error);
        });
};

const getCoordinatesForAddress = (address) => {
    const nominatimApiUrl = 'https://nominatim.openstreetmap.org/search';
    const params = {
        q: address,
        format: 'json',
    };

    return fetch(`${nominatimApiUrl}?${new URLSearchParams(params)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            }
            return [0, 0];
        })
        .catch(error => {
            console.error('Error fetching coordinates:', error);
            throw error;
        });
};

function deleteCrime(caseNumber) {
    const apiUrl = 'http://localhost:8000/remove-incident';
    fetch(apiUrl, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ case_number: caseNumber }),
    })
    .then(response => {
        if (response.ok) {
            console.log(`Crime with case number ${caseNumber} deleted successfully`);
            const updatedCrimes = crimes.value.filter(crime => crime.case_number !== caseNumber);
            crimes.value = updatedCrimes;
        } else {
            console.error(`Failed to delete crime with case number ${caseNumber}`);
        }
    })
    .catch(error => {
        console.error('Error making delete request:', error);
    });
}

//sick and twisted
let checkedIncidents = ref([]);
let checkedNeighborhoods = ref([]);
let maxResults = ref('');
let startDate = ref('');
let endDate = ref('');

//this are just the codes 
const incident_options = ref({
    '100,110,120':'Homicide',
    '210,220': 'Rape',
    '300,311,312,313,314,321,322,323,324,331,332,333,334,341,342,343,344,351,352,353,354,361,363,364,371,372,373,374': 'Robbery',
    '400,410,411,412,420,421,422,430,431,432,440,441,442,450,451,452,453': 'Aggravated Assault',
    '500,510,511,513,515,516,520,521,523,525,526,530,531,533,535,536,540,541,543,545,546,550,551,553,555,556,560,561,563,565,566': 'Burglary',
    '600,601,603,611,612,613,614,621,622,623,630,631,632,633,640,641,642,643,651,652,653,661,662,663,671,672,673,681,682,683,691,692,693': 'Theft',
    '700,710,711,712,720,721,722,730,731,732': 'Motor Vehicle Theft',
    '810,861,862,863': 'Assault Domestic',
    '900,901,903,905,911,913,915,921,922,923,925,931,933,941,942,951,961,971,972,975,981,982': 'Arson',
    '1400,1401,1410,1415,1416,1420,1425,1426,1430,1435,1436': 'Criminal Damage',
    '1800,1810,1811,1812,1813,1814,1815,1820,1822,1823,1824,1825,1830,1835,1840,1841,1842,1843,1844,1845,1850,1855,1860,1865,1870,1880,1885': 'Narcotics',
    '2619': 'Weapons',
    '3100': 'Death Investigation',
    '9954': 'Proactive Police Visit',
    '9959': 'Community Engagement',
    '9986': 'Proactive Foot Patrol'
});

const neighborhood_options = ref({
    1: 'Conway/Battlecreek/Highwood',
    2: 'Greater East Side',
    3: 'West Side',
    4: 'Dayton\'s Bluff',
    5: 'Payne/Phalen',
    6: 'North End',
    7: 'Thomas/Dale(Frogtown)',
    8: 'Summit/University',
    9: 'West Seventh',
    10: 'Como',
    11: 'Hamline/Midway',
    12: 'St. Anthony',
    13: 'Union Park',
    14: 'Macalester-Groveland',
    15: 'Highland',
    16: 'Summit Hill',
    17: 'Capitol River'
});


function updateFilter(){
    console.log('pls tell me you see me');
    let inc_list = '';
    let neighborhood_list = '';
    let date_list = '';
    let limit_list = '';
    let total_parameters;

    if (checkedIncidents.value.length>0){
        inc_list = "code="
        if (checkedIncidents.value.length>1){
            inc_list += checkedIncidents.value[0];
            for (let i=1; i<checkedIncidents.value.length; i++){
                inc_list += ","+ checkedIncidents.value[i];
            }
        } else {
            inc_list += checkedIncidents.value[0];
        }
    }

    if (checkedNeighborhoods.value.length>0){
        neighborhood_list = "neighborhood="
        if (checkedNeighborhoods.value.length>1){
            neighborhood_list += checkedNeighborhoods.value[0];

            for (let i=1; i<checkedNeighborhoods.value.length; i++){
                neighborhood_list += ","+ checkedNeighborhoods.value[i];
            }
        } else {
            neighborhood_list += checkedNeighborhoods.value[0];
        }
    }

    if (startDate.value && endDate.value){
        date_list = "start_date="+startDate.value+"&end_date="+endDate.value;
    } else if (startDate.value) {
        date_list = "start_date="+startDate.value;
    } else if (endDate.value) {
        date_list = "end_date="+endDate.value;
    }

    if (maxResults.value) {
        limit_list = "limit=" + maxResults.value;
    } 

    total_parameters = inc_list+'&'+neighborhood_list+'&'+date_list+'&'+limit_list;
    if (total_parameters.includes('&&&')){
        total_parameters = total_parameters.replace('&&&', '&');
    } else if (total_parameters.includes('&&')){
        total_parameters = total_parameters.replace('&&', '&');
    }
    if (total_parameters[0]=='&'){
        total_parameters = total_parameters.substring(1);
    }

    console.log(total_parameters);
    fetch(`${crime_url.value}/incidents?${total_parameters}`)
    .then ((res) => {
        console.log(res);
        return res.json();
    })
    .then((data) => {
        console.log(data);
        crimes.value = data;
    })
    .catch((err) =>{
        console.log(err)
    });
    
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

    <dialog id="location-dialog" hidden open>
        <input id="location" class="dialog-input" type="text" v-model="location_input" placeholder="Enter location"/>
        <button id="go-button" class="button" type="button" @click="updateMapLocation">Go</button>
    </dialog>

    <div class="grid-container">
        <div class="grid-x grid-padding-x">
            <div id="leafletmap" class="cell auto"></div>
        </div>
    </div>



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
                    <td>{{ crime.incident }}</td>
                    <td>{{ crime.date }}</td>
                    <td>{{ crime.time }}</td>
                    <td>{{ neighborhood_options[crime.neighborhood_number] }}</td>
                    <td>{{ crime.block }}</td>
                    <td>
                        <button id="details-button" @click="handleCrimeSelection(crime)">View Details</button>
                    </td>

                    <!--<td>{{ crime.police_grid }}</td>-->
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else>
      <p>Enter API URL to view crime data</p>
    </div>

    
    <!--FILTERS-->
    <div>
        <div class="grid-x grid-padding-x">
            <h3>Filters</h3>
            <!-- Incident Type Filter -->
            <div class="cell small-11 large-11">
                <label for="incident_filter"> Filter by Incident Type: </label>
                <div v-for="(key, value) in incident_options">
                    <input
                        type="checkbox"
                        :id="key"
                        :value="value"
                        v-model="checkedIncidents"
                    />
                    <label :for="value">{{ key }}</label>
                </div>
            </div>

            <!-- Neighborhood Filter -->
            <div class="cell small-11 large-11">
                <label for="incident_filter"> Filter by Neighborhood: </label>
                <div v-for="(key, value) in neighborhood_options">
                    <input
                        type="checkbox"
                        :id="key"
                        :value="value"
                        v-model="checkedNeighborhoods"
                    />
                    <label :for="value">{{ key }}</label>
                </div>
            </div>

            <!-- Date Range Filter -->
            <div>
                <div class="cell small-11 large-11">
                    <label>Start Date:</label>
                    <input type="date" v-model="startDate" />
                </div>

                <div class="cell small-11 large-11">
                    <label>End Date:</label>
                    <input type="date" v-model="endDate" />
                </div>
            </div>

            <!--max incidents / limit-->
            <div class="cell small-11 large-11">
                <label for="incident_limit"> Maximum amount of incidents: </label>
                <input type="number" v-model="maxResults" min="1" />
            </div>

            <!--update filter-->
            <button @click="updateFilter">Update Filter</button>
        </div>
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
    height: 750px;
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

#location-dialog {
    height:7rem;
    width: 24rem;
    z-index: 9999;
}

#go-button {
    font-size: x-small;
}

#details-button {
    background-color: #a0b8d2;
    color: #000000;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

#details-button:hover {
    background-color: #427bb8; /* Change background color on hover */
}

</style>
