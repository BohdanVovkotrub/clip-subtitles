const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);


const updateRenders = () => {
  if (!document) return;

  const renders = window.renders;
  const currentFile = window.currentFile;

  const myRendersModal = document.querySelector('#my-renders-modal');
  const modalBody = myRendersModal.querySelector('.modal-body');
  const buttonRender = document.querySelector('.btn-render');

  while (modalBody.firstChild) {
    modalBody.firstChild.remove();
  };

  const createHtmlRenderItem = (filename = '', percentage = ' --%') => {
    const wrapper = document.createElement('div');
    const filenameContainer = document.createElement('span');
    const percentageContainer = document.createElement('span');
    filenameContainer.classList.add('mx-1');
    percentageContainer.classList.add('mx-1');
    filenameContainer.textContent = filename;
    percentageContainer.textContent = percentage;
    wrapper.append(filenameContainer);
    wrapper.append(percentage);
    return wrapper;
  };

  if (!renders) return;
  let currentIsRendering = false;

  renders.forEach(render => {
    const { filename, progress, fullpath } = render;
    console.log(progress.percentage)
    buttonRender.querySelector('.percentage').textContent = progress.percentage;
    const htmlRenderItem = createHtmlRenderItem(filename, progress.percentage);
    modalBody.append(htmlRenderItem);
    if (fullpath === currentFile.fullpath) currentIsRendering = true;
  });
  
  if (currentIsRendering === true) {
    buttonRender.classList.add('is-rendering');
    
    buttonRender.disabled = true;
  } else {
    buttonRender.classList.remove('is-rendering');
    buttonRender.disabled = false;
  };
};

ipcRenderer.on('renders', (event, {renders, currentFile}) => {
  window.renders = renders;
  window.currentFile = currentFile;
  
  updateRenders();
});

ipcRenderer.on('alert-error', (event, error) => {
  alert(error);
});

setTimeout(() => updateRenders(), 5 * 1000);