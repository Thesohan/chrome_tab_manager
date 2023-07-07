const MAX_OPEN_TABS = 10

chrome.runtime.onInstalled.addListener(() => {

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

        };
      
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
              chrome.tabs.remove(keyToBeDeleted);
          }
        };
      }

    var obj = new LRUCache(MAX_OPEN_TABS)
  
  
    chrome.tabs.onActivated.addListener((activeInfo) => {
        console.log("on activated",activeInfo.tabId)
        const tabId = activeInfo.tabId;
        obj.put(tabId,Date.now())          
    });
  
    chrome.tabs.onRemoved.addListener((tabId) => {
        console.log("on removed",tabId)

        obj.cache.delete(tabId)
    });
  });
  