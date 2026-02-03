// 加载基础数据源
let baseDataSource = {};
let baseDataSourceLoaded = false;

async function loadBaseDataSource() {
  try {
    const response = await fetch(chrome.runtime.getURL('sourcedata.json'));
    baseDataSource = await response.json();
    baseDataSourceLoaded = true;
    console.log('基础数据源加载完成');
  } catch (error) {
    console.error('加载基础数据源失败:', error);
    baseDataSourceLoaded = false;
  }
}

// 确保数据源加载完成
loadBaseDataSource();

// 获取基础数据源（如果未加载则等待）
async function getBaseDataSource() {
  if (!baseDataSourceLoaded) {
    // 如果还没加载完成，等待最多5秒
    let attempts = 0;
    while (!baseDataSourceLoaded && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }
  return baseDataSource;
}

// 从URL中提取域名
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url.replace('www.', '');
  }
}

// 格式化日期
function formatDate(date) {
  return `${date.getFullYear()}|${String(date.getMonth() + 1).padStart(2, '0')}|${String(date.getDate()).padStart(2, '0')}`;
}

// 获取三个月前的日期范围
function getThreeMonthsDateRange() {
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
  
  return {
    from: threeMonthsAgo,
    to: lastDay
  };
}

// 获取所有cookie
async function getAllCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: 'pro.similarweb.com'
    });
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('Error getting cookies:', error);
    throw new Error('Failed to get cookies. Please make sure you are logged in to SimilarWeb Pro.');
  }
}

// 获取单个域名的数据
async function fetchDomainData(domain, fromDate, toDate) {
  const fromStr = formatDate(fromDate);
  const toStr = formatDate(toDate);
  const cookies = await getAllCookies();

  const url = `https://pro.similarweb.com/api/WebsiteOverview/getheader?mainDomainOnly=false&includeCrossData=true&key=${domain}&isWWW=false&country=999&to=${toStr}&from=${fromStr}&isWindow=false&webSource=Total&ignoreFilterConsistency=false`;

  const pageViewId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'accept-language': 'zh-CN,zh;q=0.9',
      'cache-control': 'no-cache',
      'content-type': 'application/json; charset=utf-8',
      'cookie': cookies,
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      'x-sw-page': `https://pro.similarweb.com/#/digitalsuite/websiteanalysis/overview/website-performance/*/999/28d?webSource=Total&key=${domain}`,
      'x-sw-page-view-id': pageViewId
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 格式化访问量
function formatVisits(visits) {
  if (visits === 0) return '0';
  if (visits === '') return '—';
  
  const units = ['千', '万', '亿'];
  const bases = [1000, 10000, 100000000];
  
  let value = visits;
  let unitIndex = -1;
  
  for (let i = bases.length - 1; i >= 0; i--) {
    if (value >= bases[i]) {
      value = value / bases[i];
      unitIndex = i;
      break;
    }
  }
  
  value = Math.round(value * 10) / 10;
  
  if (unitIndex === -1) {
    return value.toString();
  }
  
  return `${value}${units[unitIndex]}`;
}

// 深度合并对象
function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target));
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!result[key]) {
        result[key] = {};
      }
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// 合并数据源
function mergeDataSources(base, custom, mode) {
  if (mode === 'override') {
    // 覆盖模式：只使用输入的数据源，忽略基础数据源
    return JSON.parse(JSON.stringify(custom));
  } else {
    // 合并模式：基础数据源 + 输入数据源（基础数据优先，输入数据补充）
    return deepMerge(base, custom);
  }
}

// 从数据源中提取所有域名
function extractDomainsFromDataSource(dataSource) {
  const domains = [];
  
  function traverse(obj, path = []) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    // 如果是数组，遍历数组元素
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (item && typeof item === 'object') {
          traverse(item, [...path, index]);
        }
      });
      return;
    }
    
    // 如果是普通对象
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if (value.link) {
          // 找到包含 link 的对象
          domains.push({
            domain: extractDomain(value.link),
            path: [...path, key],
            originalValue: value
          });
        } else if (Array.isArray(value)) {
          // 如果是数组，递归处理
          traverse(value, [...path, key]);
        } else {
          // 普通对象，继续递归
          traverse(value, [...path, key]);
        }
      }
    }
  }
  
  traverse(dataSource);
  return domains;
}

// 根据路径更新数据源中的值
function updateValueByPath(dataSource, path, newValue) {
  if (!path || path.length === 0) {
    console.warn('updateValueByPath: 路径为空');
    return;
  }
  
  let current = dataSource;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current || typeof current !== 'object') {
      console.warn(`updateValueByPath: 路径 ${path.slice(0, i + 1).join('.')} 不存在或不是对象`);
      return;
    }
    
    // 如果是数组路径
    if (Array.isArray(current)) {
      const index = parseInt(path[i]);
      if (isNaN(index) || index < 0 || index >= current.length) {
        console.warn(`updateValueByPath: 数组索引 ${path[i]} 无效`);
        return;
      }
      current = current[index];
    } else {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
  }
  
  // 更新最后一个路径的值
  const lastKey = path[path.length - 1];
  if (Array.isArray(current)) {
    const index = parseInt(lastKey);
    if (!isNaN(index) && index >= 0 && index < current.length) {
      current[index] = { ...current[index], ...newValue };
    }
  } else if (current && typeof current === 'object') {
    current[lastKey] = { ...current[lastKey], ...newValue };
  } else {
    console.warn(`updateValueByPath: 无法更新路径 ${path.join('.')}`);
  }
}

// 生成指定范围内的随机数
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 格式化日期为年月日
function formatDateYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 处理单个域名的数据并实时更新
async function processDomainAndUpdate(domainInfo, dateRange, dataSource) {
  try {
    const data = await fetchDomainData(domainInfo.domain, dateRange.from, dateRange.to);
    const itemData = Object.values(data)[0] || {};
    const rawVisits = itemData.monthlyVisits || 0;
    const updateTime = formatDateYMD(new Date());
    
    const updatedValue = {
      ...domainInfo.originalValue,
      monthlyVisits: formatVisits(rawVisits),
      monthlyVisitsRaw: Math.floor(rawVisits), // 取整数
      updateTime: updateTime
    };
    
    updateValueByPath(dataSource, domainInfo.path, updatedValue);
    
    // 实时保存更新后的数据（深拷贝避免引用问题）
    await chrome.storage.local.set({ 
      currentDataSource: JSON.parse(JSON.stringify(dataSource))
    });
    
    return { domain: domainInfo.domain, success: true, data: updatedValue };
  } catch (error) {
    console.error(`域名 ${domainInfo.domain} 的数据获取失败:`, error);
    
    const errorValue = {
      ...domainInfo.originalValue,
      error: error.message
    };
    
    updateValueByPath(dataSource, domainInfo.path, errorValue);
    await chrome.storage.local.set({ 
      currentDataSource: JSON.parse(JSON.stringify(dataSource))
    });
    
    return { domain: domainInfo.domain, success: false, error: error.message };
  }
}

// 控制并发请求并实时更新
async function processWithConcurrencyAndUpdate(domains, dateRange, dataSource) {
  let currentIndex = 0;
  
  while (currentIndex < domains.length) {
    const currentConcurrency = getRandomInt(3, 7);
    const currentChunk = domains.slice(currentIndex, currentIndex + currentConcurrency);
    
    const promises = currentChunk.map(domainInfo => 
      processDomainAndUpdate(domainInfo, dateRange, dataSource)
    );
    
    await Promise.all(promises);
    currentIndex += currentConcurrency;
    
    if (currentIndex < domains.length) {
      const delaySeconds = getRandomInt(6, 20);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }
}

// 点击图标打开popup
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
