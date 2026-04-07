let currentStep = 0;
const mediaItems = document.querySelectorAll('.media-item');
const btn = document.getElementById('action-btn');
const statusText = document.getElementById('status-text');
const videoElement = document.getElementById('final-video');

function nextStep() {
    // 1. Ocultar el elemento actual
    mediaItems[currentStep].classList.remove('active');
    
    // 2. Incrementar el paso
    currentStep++;

    // Lógica de los pasos
    if (currentStep === 1) {
        // Estamos en la imagen de "Arreglando"
        mediaItems[currentStep].classList.add('active');
        btn.innerHTML = "⚡ Encender Dispositivo";
        statusText.innerText = "Aplicando microsoldadura y ensamblaje...";
    } 
    else if (currentStep === 2) {
        // Estamos en el Video Final
        mediaItems[currentStep].classList.add('active');
        statusText.innerText = "¡Reparación exitosa! El sistema está operativo.";
        
        // Ocultar el botón porque ya terminó el proceso
        btn.style.display = 'none';
        
        // Reproducir video automáticamente
        videoElement.play();
    }
}

const contenedorPrincipal = document.getElementById('miGaleria');
const tarjetas = document.querySelectorAll('.tarjeta');

    // Función para cerrar todo
    function cerrarTodo() {
        tarjetas.forEach(t => t.classList.remove('activa'));
        // Quitamos la clase que causa el desenfoque al contenedor padre
        contenedorPrincipal.classList.remove('modo-zoom');
    }

    tarjetas.forEach(tarjeta => {
        tarjeta.addEventListener('click', function(e) {
            // Evitamos que el clic se propague al documento inmediatamente
            e.stopPropagation(); 

            const estabaActiva = this.classList.contains('activa');

            // 1. Primero cerramos todo (reseteamos)
            cerrarTodo();

            // 2. Si la que clicamos NO estaba activa, la activamos ahora.
            if (!estabaActiva) {
                this.classList.add('activa');
                // AÑADIMOS la clase al padre para activar el efecto borroso en las demás
                contenedorPrincipal.classList.add('modo-zoom');
            }
        });
    });
// --- LÓGICA DEL MODAL DE CONTACTO ---
const contactModal = document.getElementById("contactModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.querySelector(".close-btn");

// Abrir modal
openModalBtn.onclick = function() {
    contactModal.style.display = "block";
}

// Cerrar con la X
closeModalBtn.onclick = function() {
    contactModal.style.display = "none";
}

// Cerrar si hace clic fuera de la ventana naranja
window.onclick = function(event) {
    if (event.target == contactModal) {
        contactModal.style.display = "none";
    }
}