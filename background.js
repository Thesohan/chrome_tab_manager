class LRUCache {
    
  constructor(capacity) {
      this.cache = new Map();
      this.capacity = capacity;
      console.log("CACHE SIZE ",capacity)
    }
  
  get(key) {
      
    console.log("GET",key,this.cache)
    if (!this.cache.has(key)) return -1;

    const v = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, v);
    return this.cache.get(key);

  }
  
  put(key, value) {
    console.log("put",key,this.cache)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      console.log(this.cache.keys().next().value)
      var keyToBeDeleted = this.cache.keys().next().value;
      console.log(keyToBeDeleted)
      this.cache.delete(keyToBeDeleted);  // keys().next().value returns first item's key
      return keyToBeDeleted
    }
  }

  delete(key) {
    this.cache.delete(key)
  }
}



const MAX_OPEN_TABS = 10
var obj = new LRUCache(MAX_OPEN_TABS);

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabId = activeInfo.tabId;
           
    if (obj.cache.size === 0) {
      chrome.tabs.query({}, function (tabs) {
        // if cache is 0 and there are already opened tab, push them in the cache
          console.log(tabs,"tabs")
        tabs.forEach(element => {
          if (element.id !== tabId) {
            keyToBeDeleted = obj.put(element.id, Date.now());
            if (keyToBeDeleted !== undefined) {
              console.log("keyto be deleted",keyToBeDeleted)
              chrome.tabs.remove(keyToBeDeleted);
            }      
          }
        });
        });
    }
      console.log("on activated", activeInfo.tabId);
      keyToBeDeleted = obj.put(tabId, Date.now());
      if (keyToBeDeleted !== undefined) {
        console.log("keyto be deleted",keyToBeDeleted)
        chrome.tabs.remove(keyToBeDeleted);
      }
               
    });
  
    chrome.tabs.onRemoved.addListener((tabId) => {
        console.log("on removed",tabId)
        obj.delete(tabId)
    });
  });
  

  chrome.runtime.onStartup.addListener(() => {
    chrome.runtime.reload();

  });


