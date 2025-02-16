let audioContext;
let analyser;
let gainNode;
let dataArray;
let animationId;

// Get DOM elements
const audio = document.getElementById('audioElement');
const playPauseBtn = document.getElementById('playPause');
const gainControl = document.getElementById('gainControl');
const promptInput = document.getElementById('promptInput');

// Set up D3
const svg = d3.select('#visualizer')
    .append('svg')
    .attr('width', window.innerWidth)
    .attr('height', window.innerHeight);


const apiKey = "can_you_keep_a_secret";

// Handle file upload
// document.getElementById('audioInput').onchange = function(e) {
    
//     console.log("debug: file uploaded...");
    
//     const file = e.target.files[0];
//     if (file) {
//         const url = URL.createObjectURL(file);
//         audio.src = url;
//         initAudio();
//     }
// }

// Handle preset prompts
document.querySelectorAll('.preset').forEach(button => {
    button.addEventListener('click', () => {
        const prompt = button.dataset.prompt;
        promptInput.value = prompt;
        // document.getElementById('generateButton').click();
    });
});

// Handle text prompt input
document.getElementById('generateButton').onclick = async function() {
    const prompt = promptInput.value.trim();

    setTimeout(() => {
        console.log("5 seconds have passed!");
    }, 5000);

    if (prompt) {

        // demo 01
        if (prompt.includes("nostalgia" )) {
            console.log("debug: nostalgia");
            audio.src = "./assets/youth_nostalgia.mp3";
            initAudio();
        }

        // demo 02
        else if (prompt.includes("afro")) {
            console.log("debug: afrobeats");
            audio.src = "./assets/afrobeats_chill.mp3";
            initAudio();
        } 
        
        // demo 03
        else if (prompt.includes("fast")) {
            console.log("debug: edm");
            audio.src = "./assets/edm_fast.mp3";
            initAudio();
        }

        else {

            console.log("debug: custom prompt");
            try {
                const taskId = await generateSong(prompt);
                if (taskId) {
    
                    console.log("debug: song generation complete...");
    
                    const songUrl = await retrieveSong(taskId);
                    if (songUrl) {
    
                        console.log("debug: song retrieval complete...");
    
                        audio.src = songUrl;
                        initAudio()
                    }
                }
            } catch (error) {
                console.error('Bright: Error generating song:', error)
                audio.src = "backup_song.mp3";
                initAudio();
            }
        }

    } else {
            console.log("debug: empty prompt...");
    }     
}


// Generate song via call to Suno
async function generateSong(prompt) {

    console.log("debug: building generation request to suno...");

    var myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${apiKey}`);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "custom_mode": false,
        "prompt": "",
        "tags": "pop",
        "make_instrumental": true,
        "mv": "sonic-v3-5",
        "gpt_description_prompt": prompt
    });

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
        mode: 'no-cors'
    };

    try {
        const response = await fetch("https://api.musicapi.ai/api/v1/sonic/create", requestOptions);
        const result = await response.json();

        console.log("debug: generation result...", result);

        if (result.message === "success") {
            console.log("debug: generation request to suno succeeded...");

            return result.task_id;
        }
        throw new Error(`Bright: Generation failed: ${result.message}`);
    } catch (error) {
        console.error("Bright: Error in generateSong:", error);
        throw error;
    }
}


// Retrieve generated song
async function retrieveSong(taskId) {

    console.log("debug: building retrieval request to suno...");

    const maxRetries = 2; // 1 minute total (5s * 12)
    let retryCount = 0;

    var requestOptions = {
        method: 'GET',
        redirect: 'follow'
    };

    while (retryCount < maxRetries) {
        try {
            const response = await fetch(`https://api.musicapi.ai/api/v1/sonic/task/${taskId}`, requestOptions);
            const result = await response.json();

            console.log("debug: retrieval result ...", result);

            if (result.code === 200 && result.data.audio_url) {

                console.log("debug: retrieval request to suno succeeded...");
                return result.data.audio_url;
                 
            } 
            else if (result.status === "in_progress") { // TODO: look up syntax for in progress
                
                console.log("debug: unfinished generation");
                
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
                retryCount++;
                continue;

            } else {

                throw new Error('Bright: (GET) Unexpected response status: ${result.code} ');
            
            }
            
        } catch (error) {
            console.error("Bright: Error in retrieveSong ->", error);
            if (retryCount === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
            retryCount++;
        }
    }
}
     


// Initialize audio context
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        gainNode = audioContext.createGain();
        
        // Connect nodes
        const source = audioContext.createMediaElementSource(audio);
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // Set up analyser
        analyser.fftSize = 800;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Prompt user to play generated song
        showToast();
        
        // Start visualization
        visualize();
    }
}

// Play/Pause control
playPauseBtn.onclick = function() {
    if (audio.paused) {
        audio.play();
        this.textContent = 'Pause';
    } else {
        audio.pause();
        this.textContent = 'Play';
    }
}

// Gain control
gainControl.oninput = function() {
    if (gainNode) {
        gainNode.gain.value = this.value;
    }
}

// Visualization function
function visualize() {
    animationId = requestAnimationFrame(visualize);
    analyser.getByteFrequencyData(dataArray);

    // Random base colors
    const baseRed = Math.floor(Math.random() * 256);
    const baseGreen = Math.floor(Math.random() * 256);
    const baseBlue = Math.floor(Math.random() * 256);
    
    // Calculate bar width based on window size and number of bars
    const barWidth = window.innerWidth / dataArray.length;
    
    // Update visualization
    const bars = svg.selectAll('rect')
        .data(dataArray);
    
    // Enter new bars
    bars.enter()
        .append('rect')
        .merge(bars)
        .attr('x', (d, i) => i * barWidth)
        .attr('y', d => window.innerHeight - (d * 2))
        .attr('width', barWidth - 1)
        .attr('height', d => d * 2)
        .attr('fill', d => {
            // d is your frequency data value (0-255)
            // Mix the random base color with the frequency value
            const r = Math.floor((baseRed + d) / 2);
            const g = Math.floor((baseGreen + (255 - d)) / 2);
            const b = Math.floor((baseBlue + d) / 2);
            return `rgb(${r}, ${g}, ${b})`;
        });
    
    // Remove extra bars
    bars.exit().remove();
}

// Notify user generated video is ready
function showToast() {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        document.body.removeChild(existingToast);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Your song is ready. Play it!';
    document.body.appendChild(toast);
    
    // Remove the toast after animation completes
    setTimeout(() => {
        if (toast.parentElement) {
            document.body.removeChild(toast);
        }
    }, 2500);
}

// Handle window resize
window.onresize = function() {
    svg.attr('width', window.innerWidth)
       .attr('height', window.innerHeight);
}
