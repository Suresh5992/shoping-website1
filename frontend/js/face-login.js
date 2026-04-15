(function(){
  // Face login/enroll utility
  const MODELS_URL = '/models';
  const THRESHOLD = 0.55;

  let stream = null;
  let _modelsLoaded = false;
  let _labeledDescriptorsCache = null;

  // Helpers for storage of descriptors
  function _getStored(){
    try{ return JSON.parse(localStorage.getItem('faceDescriptors')||'{}'); }catch(e){ return {}; }
  }
  function _saveStored(obj){ localStorage.setItem('faceDescriptors', JSON.stringify(obj)); }

  // Convert plain array -> Float32Array and wrap as LabeledFaceDescriptors
  function _buildLabeledDescriptors(){
    const stored = _getStored();
    const out = [];
    for(const label in stored){
      try{
        const arrs = stored[label] || [];
        const descriptors = arrs.map(a => new Float32Array(a));
        out.push(new faceapi.LabeledFaceDescriptors(label, descriptors));
      }catch(e){ console.warn('Invalid descriptor for', label, e); }
    }
    return out;
  }

  async function loadModels(){
    if(_modelsLoaded) return;
    if(!window.faceapi) throw new Error('face-api.js not loaded');
    // Prefer tiny detector (faster) and load only required nets
    try{ await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL); console.log('loaded tinyFaceDetector'); }catch(e){ console.error('tinyFaceDetector failed', e); }
    try{ await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL); console.log('loaded faceLandmark68Net'); }catch(e){ console.error('faceLandmark68Net failed', e); }
    try{ await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL); console.log('loaded faceRecognitionNet'); }catch(e){ console.error('faceRecognitionNet failed', e); }
    _modelsLoaded = true;
    console.log('face-api model load attempts completed from', MODELS_URL);
  }

  // Resize current video frame into a small canvas then run tiny detector (faster)
  function _captureFrameAsCanvas(video, width){
    const w = width || 160;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || Math.round(w * 0.75);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); try{ ctx.drawImage(video, 0, 0, w, h); }catch(e){}
    return c;
  }

  async function _detectFace(video){
    try{
      const canvas = _captureFrameAsCanvas(video, 160);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 });
      const detection = await faceapi.detectSingleFace(canvas, options).withFaceLandmarks().withFaceDescriptor();
      console.debug('Tiny detect (resized) result:', detection);
      return detection || null;
    }catch(e){ console.warn('detectFace error', e); return null; }
  }

  // Create a simple modal UI dynamically (reused for enroll/verify)
  function _ensureModal(){
    let modal = document.getElementById('fd_modal');
    if(modal) return modal;
    modal = document.createElement('div'); modal.id = 'fd_modal';
    // Ensure modal appears above other overlays (spinner uses z-index:10000)
    modal.style.cssText = 'display:none;position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;z-index:11001';
    const inner = document.createElement('div'); inner.style.cssText='background:#fff;padding:16px;border-radius:6px;max-width:460px;width:92%;text-align:center;position:relative';
    inner.innerHTML = '<h4 style="margin-top:0">Face Verification</h4>';
    const video = document.createElement('video'); video.id='fd_video'; video.width=320; video.height=240; video.autoplay=true; video.muted=true; video.style.cssText='border:1px solid #ddd;border-radius:4px;background:#000';
    const canvas = document.createElement('canvas'); canvas.id='fd_canvas'; canvas.width=320; canvas.height=240; canvas.style.display='none';
    const status = document.createElement('div'); status.id='fd_status'; status.style.marginTop='8px'; status.style.color='#333'; status.innerText='';
    const controls = document.createElement('div'); controls.style.marginTop='12px';
    const tryBtn = document.createElement('button'); tryBtn.id='fd_try'; tryBtn.className='btn btn-primary'; tryBtn.innerText='Capture & Verify';
    const cancel = document.createElement('button'); cancel.id='fd_cancel'; cancel.className='btn btn-default'; cancel.style.marginLeft='8px'; cancel.innerText='Cancel';
    controls.appendChild(tryBtn); controls.appendChild(cancel);
    inner.appendChild(video); inner.appendChild(canvas); inner.appendChild(status); inner.appendChild(controls);
    modal.appendChild(inner); document.body.appendChild(modal);
    return modal;
  }

  async function _startCamera(videoEl){
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = stream; await videoEl.play();
  }
  function _stopCamera(videoEl){ if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } try{ videoEl.pause(); videoEl.srcObject=null; }catch(e){} }

  // Enroll: capture descriptor and save under `label` in localStorage
  async function enroll(label){
    if(!label) throw new Error('label required');
    await loadModels();
    const modal = _ensureModal();
    const video = modal.querySelector('#fd_video');
    const canvas = modal.querySelector('#fd_canvas');
    const status = modal.querySelector('#fd_status');
    const tryBtn = modal.querySelector('#fd_try');
    const cancel = modal.querySelector('#fd_cancel');
    status.innerText = 'Starting camera...';
    modal.style.display='flex';
    try{
      await _startCamera(video);
    }catch(e){
      status.innerText = 'Unable to access camera: ' + (e && e.message ? e.message : e);
      throw e;
    }
    status.innerText = 'Position your face in front of the camera and click Capture.';
    return new Promise((resolve,reject)=>{
      async function doCapture(){
        status.innerText = 'Detecting face...';
        const detection = await _detectFace(video);
        if(!detection){ status.innerText='No face detected. Try again.'; return; }
        const desc = Array.from(detection.descriptor);
        const stored = _getStored();
        stored[label] = stored[label] || [];
        stored[label].push(desc);
        _saveStored(stored);
        // update cached labeled descriptors so verify can run without rebuild
        _labeledDescriptorsCache = _buildLabeledDescriptors();
        status.innerText = 'Face enrolled for ' + label;
        _stopCamera(video);
        modal.style.display='none';
        cleanup();
        resolve(true);
      }
      function cleanup(){ tryBtn.removeEventListener('click', doCapture); cancel.removeEventListener('click', onCancel); }
      function onCancel(){ _stopCamera(video); modal.style.display='none'; cleanup(); reject(new Error('cancelled')); }
      tryBtn.addEventListener('click', doCapture);
      cancel.addEventListener('click', onCancel);
    });
  }

  // Verify current user (or provided label). Returns matched label or null
  async function verify(labelToMatch){
    await loadModels();
    const modal = _ensureModal();
    const video = modal.querySelector('#fd_video');
    const canvas = modal.querySelector('#fd_canvas');
    const status = modal.querySelector('#fd_status');
    const tryBtn = modal.querySelector('#fd_try');
    const cancel = modal.querySelector('#fd_cancel');
    status.innerText = 'Starting camera...';
    modal.style.display='flex';
    try{
      await _startCamera(video);
    }catch(e){
      status.innerText = 'Unable to access camera: ' + (e && e.message ? e.message : e);
      throw e;
    }
    status.innerText = 'Click Capture to authenticate with your face.';
    return new Promise((resolve,reject)=>{
      async function doVerify(){
        status.innerText = 'Detecting...';
        const detection = await _detectFace(video);
        if(!detection){ status.innerText='No face detected. Try again.'; return; }
        const stored = _getStored();
        const labeled = _buildLabeledDescriptors();
        if(labeled.length === 0){ status.innerText='No enrolled faces found.'; return resolve(null); }
        const matcher = new faceapi.FaceMatcher(labeled, THRESHOLD);
        const best = matcher.findBestMatch(detection.descriptor);
        status.innerText = 'Best match: ' + best.toString();
        _stopCamera(video); modal.style.display='none'; cleanup();
        if(best.label === 'unknown' || best.distance > THRESHOLD) return resolve(null);
        if(labelToMatch && best.label !== labelToMatch) return resolve(null);
        resolve(best.label);
      }
      function cleanup(){ tryBtn.removeEventListener('click', doVerify); cancel.removeEventListener('click', onCancel); }
      function onCancel(){ _stopCamera(video); modal.style.display='none'; cleanup(); reject(new Error('cancelled')); }
      tryBtn.addEventListener('click', doVerify);
      cancel.addEventListener('click', onCancel);
    });
  }

  // expose API
  window.FaceLogin = {
    enroll: enroll,
    verify: verify,
    loadModels: loadModels,
    hasEnrolled: function(label){ const s=_getStored(); return !!(s[label] && s[label].length>0); }
  };

})();
