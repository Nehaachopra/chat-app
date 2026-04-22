const socket = io();

const send = document.getElementById("send");
const messages = document.querySelector(".messages");
const typing = document.getElementById("typing");

const input = document.getElementById("input");
const attachBtn = document.getElementById("attachBtn");
const attachMenu = document.getElementById("attachMenu");
const fileInput = document.getElementById("fileInput");
const imageInput = document.getElementById("imageInput");
const audioInput = document.getElementById("audioInput");

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImg");
const closeModal = document.getElementById("closeModal");

const sendImageBtn = document.getElementById("sendImage");
const captionInput = document.getElementById("captionInput");
const previewModal = document.getElementById("previewModal");
const previewImg = document.getElementById("previewImg");
const pdfCanvas = document.getElementById("pdfCanvas");
const ctx = pdfCanvas.getContext("2d");

let selectedFile = null;
let selectedType = null; // "image" | "pdf" | "other"

const sentTick = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check" viewBox="0 0 16 16">
  <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
</svg>`;

const receivedTick = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-all" viewBox="0 0 16 16">
  <path d="M8.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L2.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093L8.95 4.992zm-.92 5.14.92.92a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 1 0-1.091-1.028L9.477 9.417l-.485-.486z"/>
</svg>`;

socket.on('server:message', (msg) => {
  typing.classList.add("hidden");

  const type = "received";
  if (msg.type === "text") {
    addMessage(type, msg.createdAt, msg.id, msg.content);
  }

  else if (msg.type === "image") {
    addImageMessage(type, msg.createdAt, msg.id, msg.src, msg.content);
  }
  else if (msg.type === "pdf") {
    addPDFMessage(type, msg.createdAt, msg.id, msg.url, msg.fileName, msg.size, msg.content);
  }

  else if (msg.type === "file") {
    addFileMessage(type, msg.createdAt, msg.id, msg.fileName, msg.url, msg.content);
  }

  const el = document.querySelector(`[data-id="${msg.id}"]`);
  if (!el) return;
  const tick = el.querySelector(".tick")
  tick.innerHTML = receivedTick;

  socket.emit("message:delivered", { id: msg.id });

  if (document.visibilityState === "visible") {
    tick.classList.add("seen");
    socket.emit("message:seen", { id: msg.id });
  }
})

socket.on('server:typing', () => {
  typing.classList.remove("hidden");
})

socket.on('server:stopTyping', () => {
  typing.classList.add("hidden");
})

socket.on("message:delivered", ({ id }) => {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  const tick = el.querySelector(".tick")
  tick.innerHTML = receivedTick;
});

socket.on("message:seen", ({ id }) => {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  const tick = el.querySelector(".tick")
  tick.classList.add("seen");
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("chat-image")) {
    modalImg.src = e.target.src;
    modal.classList.remove("hidden");
  }

  //close when clicked outside!
  attachMenu.classList.add("hidden");
});

attachBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  attachMenu.classList.toggle("hidden");
});

document.querySelectorAll(".attach-item").forEach(item => {
  item.addEventListener("click", () => {
    socket.emit('user:typing');

    const text = item.innerText;

    if (text.includes("Document")) {
      fileInput.click();
    }

    if (text.includes("Gallery")) {
      imageInput.click();
    }

    if (text.includes("Audio")) {
      audioInput.click();
    }

    if (text.includes("Camera")) {
      imageInput.setAttribute("capture", "environment");
      imageInput.click();
    }

    // Others (mock for now)
    if (text.includes("Location") || text.includes("Contact")) {
      alert(text + " feature not implemented yet");
    }
    attachMenu.classList.add("hidden");
  });
});

send.addEventListener("click", (e) => {
  const message = input.value.trim();
  if (message === "") {
    return;
  }
  const id = addMessage("sent", null, null, message);
  input.value = "";
  emitMessage("text", id, message);
});

input.addEventListener("input", (e) => {
    const text = e.target.value;
    if (text.length > 0) {socket.emit('user:typing')}
    else {socket.emit("user:stopTyping")} 
});

fileInput.addEventListener("change", handleFile);
imageInput.addEventListener("change", handleFile);
audioInput.addEventListener("change", handleFile);

sendImageBtn.addEventListener('click', () => {
  const caption = captionInput.value;

  if (selectedType === "image") {
    const src = previewImg.src
    const id = addImageMessage("sent", src, caption);
    emitMessage("image", id, caption, src)
  }

  else if (selectedType === "pdf") {
    const url = URL.createObjectURL(selectedFile);
    const id = addPDFMessage("sent", url, selectedFile.name, selectedFile.size, null,caption);
    emitMessage("pdf", id, caption, null, selectedFile.name, url, selectedFile.size);
  }

  else {
    const url = URL.createObjectURL(selectedFile);
    const id = addFileMessage("sent", selectedFile.name, url, caption);
    emitMessage("file", id, caption, null, selectedFile.name, url);
  }
  resetPreview();
});

document.getElementById("closePreview").addEventListener("click", () => {
  previewModal.classList.add("hidden");
  captionInput.value = "";
  socket.emit("user:stopTyping");
})

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
  socket.emit("user:stopTyping");
});
// modal.addEventListener('click', () => modal.classList.add("hidden"));

function addMessage(type, timestamp=null, id=null, text) {
  const div = document.createElement("div");
  div.className = `message ${type}`;

  div.innerHTML = `
    ${text}
    <div class="meta">
      <span>${time(timestamp)}</span>
      <span class="tick">${sentTick}</span>
    </div>
  `;

  id = id ?? createId();
  div.dataset.id = id;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return id;
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) {
    return;
  }

  const type = file.type;

  if (type.startsWith("image/")) {
    const reader = new FileReader();

    reader.onload = () => {
      previewImg.src = reader.result;
      previewImg.classList.remove("hidden");
      pdfCanvas.classList.add("hidden");
      previewModal.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } 
  else if (type === "application/pdf") {
    selectedType = "pdf";
    selectedFile = file;

    renderPDFPreview(file);
    previewImg.classList.add("hidden");
    pdfCanvas.classList.remove("hidden");

    previewModal.classList.remove("hidden");
  }
  else {
    selectedType = "other";

    previewImg.classList.add("hidden");
    pdfCanvas.classList.add("hidden");

    previewModal.classList.remove("hidden");
  }
}

function addImageMessage(type, timestamp=null, id, src, caption) {
  const div = document.createElement("div");
  div.className = `message ${type}`;

  div.innerHTML = `
    <img src="${src}" class="chat-image" />
    ${caption.length > 0 ? `<p class="caption">${caption}</p>` : ""}
    <div class="meta">
      <span>${time(timestamp)}</span>
      <span class="tick">${sentTick}</span>
    </div>
  `;

  id = id ?? createId();
  div.id = id;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return id;
}

function addPDFMessage(type, datetime=null, id, url, fileName, fileSize, caption=null) {

  const div = document.createElement("div");
  div.className = `message ${type}`;

  div.innerHTML = `
    <a href="${url}" target="_blank" class="file-card">
      <div class="file-icon">📄</div>
      <div class="file-info">
        <span class="file-name">${fileName}</span>
        <span class="file-size">${formatSize(fileSize)}</span>
      </div>
    </a>
    ${caption.length > 0 ? `<p class="caption">${caption}</p>` : ""}
    <div class="meta">
      <span>${time(datetime)}</span>
      <span class="tick">${sentTick}</span>
    </div>
  `;

  id = id ?? createId();
  div.id = id;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return id;
}

function addFileMessage(type, datetime=null, id, fileName, url, caption) {
  const div = document.createElement("div");
  div.className = `message ${type}`;

  div.innerHTML = `
    <a href="${url}" download="${fileName}" class="file-link">
      📄 ${fileName}
    </a>
    ${caption.length > 0 ? `<p class="caption">${caption}</p>` : ""}
    <div class="meta">
      <span>${time(datetime)}</span>
      <span class="tick">${sentTick}</span>  
    </div>
  `;

  id = id ?? createId();
  div.id = id;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return id;
}

function time(datetime=null) {
  const d = datetime ? new Date(datetime): new Date();
  return d.getHours() + ":" + d.getMinutes().toString().padStart(2,"0");
}

function renderPDFPreview(file) {
  const reader = new FileReader();

  reader.onload = function () {
    const typedArray = new Uint8Array(this.result);

    pdfjsLib.getDocument(typedArray).promise.then(pdf => {
      pdf.getPage(1).then(page => {

        const viewport = page.getViewport({ scale: 1.2 });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        page.render({
          canvasContext: ctx,
          viewport: viewport
        });
      });
    });
  };

  reader.readAsArrayBuffer(file);
}

function resetPreview() {
  selectedFile = null;
  selectedType = null;
  captionInput.value = "";
  previewModal.classList.add("hidden");
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function emitMessage(type, id, content=null, src=null, fileName=null, url=null, size=null) {
  const data = {
    id,
    type,
    content,
    src,
    fileName,
    url,
    size,
    sender: "",
    createdAt: new Date().toISOString()
  }

  socket.emit('user:message', data);
}

function createId() {

  return Date.now();
}