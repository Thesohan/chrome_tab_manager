document.addEventListener("DOMContentLoaded", () => {
    const icon16Input = document.getElementById("icon16");
    const icon48Input = document.getElementById("icon48");
    const icon128Input = document.getElementById("icon128");
    const saveButton = document.getElementById("saveButton");
  
    // Load saved icon paths
    chrome.storage.sync.get(["icon16", "icon48", "icon128"], (result) => {
      icon16Input.value = result.icon16 || "";
      icon48Input.value = result.icon48 || "";
      icon128Input.value = result.icon128 || "";
    });
  
    // Save icon paths when the save button is clicked
    saveButton.addEventListener("click", () => {
      const icon16 = icon16Input.value.trim();
      const icon48 = icon48Input.value.trim();
      const icon128 = icon128Input.value.trim();
  
      chrome.storage.sync.set({ icon16, icon48, icon128 }, () => {
        console.log("Icon paths saved");
      });
    });
  });
  