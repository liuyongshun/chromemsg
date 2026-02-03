document.addEventListener('DOMContentLoaded', async function() {
  // 获取DOM元素
  const jsonInput = document.getElementById('jsonInput');
  const mergeMode = document.getElementById('mergeMode');
  const startButton = document.getElementById('startButton');
  const jsonView = document.getElementById('jsonView');
  const jsonViewContainer = document.getElementById('jsonViewContainer');
  const prettyView = document.getElementById('prettyView');
  const progressInfo = document.getElementById('progressInfo');
  const viewButtons = document.querySelectorAll('.view-btn');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const copyStatus = document.getElementById('copyStatus');
  const mergeModeHint = document.getElementById('mergeModeHint');

  // 检查必要的DOM元素是否存在
  if (!jsonInput || !mergeMode || !startButton || !jsonView || !prettyView || !progressInfo) {
    console.error('必要的DOM元素未找到');
    return;
  }

  // 加载基础数据源
  let baseDataSource = {};
  try {
    const response = await fetch(chrome.runtime.getURL('sourcedata.json'));
    baseDataSource = await response.json();
  } catch (error) {
    console.error('加载基础数据源失败:', error);
  }

  // 加载保存的设置
  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'mergeMode',
        'customDataSource',
        'currentDataSource'
      ]);

      if (mergeMode && settings.mergeMode) {
        mergeMode.value = settings.mergeMode;
      }
      if (jsonInput && settings.customDataSource) {
        jsonInput.value = JSON.stringify(settings.customDataSource, null, 2);
      }
      
      // 如果有保存的结果，显示它；否则显示基础数据源
      if (settings.currentDataSource) {
        updateDisplay(settings.currentDataSource);
      } else if (baseDataSource && Object.keys(baseDataSource).length > 0) {
        // 默认显示基础数据源
        updateDisplay(baseDataSource);
      }
      
      return settings;
    } catch (error) {
      console.error('加载设置失败:', error);
      return null;
    }
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
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      return cookieString;
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

    const data = await response.json();
    return data;
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

  // 生成指定范围内的随机数
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

  // 格式化日期为年月日
  function formatDateYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 处理单个域名的数据并实时更新
  async function processDomainAndUpdate(domainInfo, dateRange, dataSource, updateCallback) {
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
      
      // 实时保存更新后的数据
      await chrome.storage.local.set({ currentDataSource: JSON.parse(JSON.stringify(dataSource)) });
      
      if (updateCallback) {
        updateCallback({
          domain: domainInfo.domain,
          success: true,
          data: updatedValue,
          dataSource: JSON.parse(JSON.stringify(dataSource))
        });
      }
      
      return { domain: domainInfo.domain, success: true, data: updatedValue };
    } catch (error) {
      console.error(`域名 ${domainInfo.domain} 的数据获取失败:`, error);
      
      const errorValue = {
        ...domainInfo.originalValue,
        error: error.message
      };
      
      updateValueByPath(dataSource, domainInfo.path, errorValue);
      await chrome.storage.local.set({ currentDataSource: JSON.parse(JSON.stringify(dataSource)) });
      
      if (updateCallback) {
        updateCallback({
          domain: domainInfo.domain,
          success: false,
          error: error.message,
          dataSource: JSON.parse(JSON.stringify(dataSource))
        });
      }
      
      return { domain: domainInfo.domain, success: false, error: error.message };
    }
  }

  // 控制并发请求并实时更新
  async function processWithConcurrencyAndUpdate(domains, dateRange, dataSource, updateCallback) {
    let currentIndex = 0;
    let successCount = 0;
    let failCount = 0;
    
    while (currentIndex < domains.length) {
      const currentConcurrency = getRandomInt(3, 7);
      const currentChunk = domains.slice(currentIndex, currentIndex + currentConcurrency);
      
      const promises = currentChunk.map((domainInfo, index) => 
        processDomainAndUpdate(domainInfo, dateRange, dataSource, (result) => {
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
          if (updateCallback) {
            updateCallback({
              current: currentIndex + index + 1,
              total: domains.length,
              success: successCount,
              failed: failCount,
              domain: result.domain,
              result: {
                ...result,
                dataSource: JSON.parse(JSON.stringify(dataSource))
              }
            });
          }
        })
      );
      
      await Promise.all(promises);
      currentIndex += currentConcurrency;
      
      if (currentIndex < domains.length) {
        const delaySeconds = getRandomInt(6, 20);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }
    
    return { success: successCount, failed: failCount };
  }

  // 执行数据获取任务
  async function executeDataFetch(dataSource, updateProgressCallback) {
    const dateRange = getThreeMonthsDateRange();
    const domains = extractDomainsFromDataSource(dataSource);
    
    if (domains.length === 0) {
      throw new Error('数据源中没有找到有效的域名');
    }
    
    // 创建数据源的深拷贝
    const workingDataSource = JSON.parse(JSON.stringify(dataSource));
    
    const results = await processWithConcurrencyAndUpdate(
      domains,
      dateRange,
      workingDataSource,
      updateProgressCallback
    );
    
    return {
      dataSource: workingDataSource,
      stats: results
    };
  }

  // 解析输入数据
  function parseInput(input) {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      
      // 如果是数组，标记为简单输入（不合并）
      if (Array.isArray(parsed)) {
        return {
          _isSimpleInput: true,
          _inputType: 'array',
          "手动输入": parsed.reduce((acc, domain, index) => {
            acc[`domain${index + 1}`] = {
              link: domain.startsWith('http') ? domain : `https://${domain}`,
              desc: ["手动输入"]
            };
            return acc;
          }, {})
        };
      }
      
      // 如果是对象，检查是否为空对象
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          _isSimpleInput: false,
          _inputType: 'object',
          ...parsed
        };
      }
      
      throw new Error('输入必须是有效的JSON对象或数组');
    } catch (e) {
      // 如果不是JSON，作为单个域名处理（标记为简单输入，不合并）
      return {
        _isSimpleInput: true,
        _inputType: 'string',
        "手动输入": {
          "domain": {
            link: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
            desc: ["手动输入"]
          }
        }
      };
    }
  }
  
  // 清理输入数据源中的标记字段
  function cleanInputDataSource(inputDataSource) {
    if (!inputDataSource || typeof inputDataSource !== 'object') {
      return inputDataSource;
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(inputDataSource)) {
      if (key !== '_isSimpleInput' && key !== '_inputType') {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  // 检测输入类型并更新提示信息
  function updateMergeModeState() {
    if (!jsonInput || !mergeMode || !mergeModeHint) {
      return;
    }
    
    const input = jsonInput.value.trim();
    
    if (!input) {
      // 空输入：允许合并和覆盖
      mergeModeHint.textContent = '';
      mergeModeHint.className = 'merge-hint';
      return;
    }

    // 使用 parseInput 函数解析输入，保持与实际执行逻辑一致
    try {
      const parsedInput = parseInput(input);
      
      if (!parsedInput) {
        mergeModeHint.textContent = '';
        mergeModeHint.className = 'merge-hint';
        return;
      }

      // 检查是否是简单输入（字符串或数组）
      const isSimpleInput = parsedInput._isSimpleInput === true;
      const inputType = parsedInput._inputType;
      const currentMode = mergeMode.value;

      if (isSimpleInput) {
        // 字符串或数组输入：无法合并
        if (currentMode === 'merge') {
          // 如果选择了合并模式，显示警告
          if (inputType === 'array') {
            mergeModeHint.textContent = '⚠️ 数组输入无法合并，请选择覆盖模式';
          } else {
            mergeModeHint.textContent = '⚠️ 字符串输入无法合并，请选择覆盖模式';
          }
          mergeModeHint.className = 'merge-hint warning';
        } else {
          // 覆盖模式，显示提示
          if (inputType === 'array') {
            mergeModeHint.textContent = 'ℹ️ 数组输入将直接使用，不合并基础数据';
          } else {
            mergeModeHint.textContent = 'ℹ️ 字符串输入将直接使用，不合并基础数据';
          }
          mergeModeHint.className = 'merge-hint info';
        }
      } else {
        // JSON对象输入：可以合并
        if (currentMode === 'merge') {
          mergeModeHint.textContent = '✓ 合并模式：将合并基础数据源和输入数据';
        } else {
          mergeModeHint.textContent = '✓ 覆盖模式：只使用输入数据，忽略基础数据源';
        }
        mergeModeHint.className = 'merge-hint info';
      }
    } catch (error) {
      // 解析失败，显示错误
      mergeModeHint.textContent = '⚠️ 输入格式错误，请检查JSON格式';
      mergeModeHint.className = 'merge-hint warning';
    }
  }

  // 监听输入变化
  if (jsonInput) {
    jsonInput.addEventListener('input', () => {
      updateMergeModeState();
    });
  }

  // 监听合并模式变化
  if (mergeMode) {
    mergeMode.addEventListener('change', () => {
      updateMergeModeState();
    });
  }

  // 开始执行按钮
  startButton.addEventListener('click', async () => {
    try {
      const input = jsonInput.value.trim();
      startButton.disabled = true;
      progressInfo.textContent = '正在准备数据源...';
      jsonView.textContent = '';
      prettyView.innerHTML = '';
      
      let finalDataSource = baseDataSource;
      let inputDataSource = null;
      let isSimpleInput = false;
      const mergeModeValue = mergeMode.value;
      
      // 如果有输入，解析并处理
      if (input) {
        inputDataSource = parseInput(input);
        if (!inputDataSource) {
          throw new Error('无法解析输入数据');
        }
        
        // 检查是否是简单输入（字符串或数组）
        isSimpleInput = inputDataSource._isSimpleInput === true;
        const cleanedInput = cleanInputDataSource(inputDataSource);
        
        if (isSimpleInput) {
          // 字符串或数组输入：直接使用，不合并
          finalDataSource = cleanedInput;
          progressInfo.textContent = '检测到简单输入（字符串/数组），直接使用输入数据...';
        } else {
          // 对象输入：根据合并模式处理
          if (mergeModeValue === 'override') {
            // 覆盖模式：只使用输入的数据源，忽略基础数据源
            finalDataSource = cleanedInput;
            progressInfo.textContent = '使用覆盖模式，仅处理输入的数据源...';
          } else {
            // 合并模式：合并基础数据源和输入数据源
            finalDataSource = mergeDataSources(baseDataSource, cleanedInput, mergeModeValue);
            progressInfo.textContent = '使用合并模式，合并基础数据源和输入数据源...';
          }
        }
      } else {
        // 如果没有输入，只使用基础数据源
        progressInfo.textContent = '使用默认基础数据源...';
      }

      // 保存设置（保存清理后的数据源）
      const cleanedInput = inputDataSource ? cleanInputDataSource(inputDataSource) : null;
      await chrome.storage.local.set({
        mergeMode: mergeModeValue,
        customDataSource: cleanedInput
      });

      // 立即执行
      progressInfo.textContent = `开始处理，共 ${extractDomainsFromDataSource(finalDataSource).length} 个域名...`;
      
      const result = await executeDataFetch(finalDataSource, (progress) => {
        progressInfo.textContent = `进度: ${progress.current}/${progress.total} | 成功: ${progress.success} | 失败: ${progress.failed} | 当前: ${progress.domain}`;
        // 实时显示更新后的数据
        if (progress.result && progress.result.dataSource) {
          updateDisplay(progress.result.dataSource);
        }
      });
      
      progressInfo.textContent = `完成！成功: ${result.stats.success} | 失败: ${result.stats.failed}`;
      updateDisplay(result.dataSource);
      
      // 保存最终结果
      await chrome.storage.local.set({ currentDataSource: result.dataSource });
          } catch (error) {
      console.error('处理过程中发生错误:', error);
      progressInfo.textContent = `错误: ${error.message}`;
      jsonView.textContent = `Error: ${error.message}`;
      prettyView.innerHTML = `<div style="padding: 20px; text-align: center; color: #ea4335;">错误: ${error.message}</div>`;
    } finally {
      startButton.disabled = false;
    }
  });

  // 过滤数据：移除 monthlyVisitsRaw 为 0 或为空的数据
  function filterData(dataSource) {
    if (!dataSource || typeof dataSource !== 'object') {
      return {};
    }

    const filtered = {};
    
    for (const [categoryName, categoryData] of Object.entries(dataSource)) {
      if (!categoryData || typeof categoryData !== 'object') continue;
      
      const filteredCategory = {};
      
      for (const [itemName, itemData] of Object.entries(categoryData)) {
        if (!itemData || typeof itemData !== 'object') continue;
        
        // 过滤条件：
        // 1. 如果 monthlyVisitsRaw 不存在（undefined），保留（数据还未获取）
        // 2. 如果 monthlyVisitsRaw 存在，只有当它不为 0 且不为空时才保留
        const rawVisits = itemData.monthlyVisitsRaw;
        if (rawVisits === undefined || rawVisits === null) {
          // 数据还未获取，保留
          filteredCategory[itemName] = itemData;
        } else if (rawVisits !== '' && rawVisits !== 0) {
          // 数据已获取，且不为空和0，保留
          filteredCategory[itemName] = itemData;
        }
        // 其他情况（空字符串或0）过滤掉
      }
      
      // 只添加有数据的分类
      if (Object.keys(filteredCategory).length > 0) {
        filtered[categoryName] = filteredCategory;
      }
    }
    
    return filtered;
  }

  // 渲染美化视图（使用横向Tab分类）
  function renderPrettyView(dataSource) {
    if (!prettyView) {
      return;
    }
    
    if (!dataSource || typeof dataSource !== 'object') {
      prettyView.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
      return;
    }

    // 过滤数据
    const filteredData = filterData(dataSource);

    if (Object.keys(filteredData).length === 0) {
      prettyView.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无符合条件的数据（已过滤掉访问量为0或空的数据）</div>';
      return;
    }

    const categories = Object.keys(filteredData);
    let html = '';
    
    // 生成Tab按钮
    html += '<div class="category-tabs">';
    categories.forEach((categoryName, index) => {
      const isActive = index === 0 ? 'active' : '';
      html += `<div class="category-tab ${isActive}" data-category="${categoryName}">${categoryName}</div>`;
    });
    html += '</div>';
    
    // 生成Tab内容
    categories.forEach((categoryName, index) => {
      const categoryData = filteredData[categoryName];
      if (!categoryData || typeof categoryData !== 'object') return;
      
      const isActive = index === 0 ? 'active' : '';
      html += `<div class="category-content ${isActive}" data-category="${categoryName}">`;
      
      // 将分类数据转换为数组并排序
      const itemsArray = Object.entries(categoryData)
        .map(([itemName, itemData]) => ({
          name: itemName,
            data: itemData,
          rawVisits: itemData.monthlyVisitsRaw !== undefined ? itemData.monthlyVisitsRaw : -1 // 未获取的数据使用-1，排在最后
        }))
        .sort((a, b) => {
          // 从大到小排序，未获取的数据（-1）排在最后
          if (a.rawVisits === -1 && b.rawVisits === -1) return 0;
          if (a.rawVisits === -1) return 1;
          if (b.rawVisits === -1) return -1;
          return b.rawVisits - a.rawVisits;
        });
      
      if (itemsArray.length === 0) {
        html += '<div class="category-content empty">该分类暂无数据</div>';
      } else {
        itemsArray.forEach(({ name: itemName, data: itemData }) => {
          if (!itemData || typeof itemData !== 'object') return;
          
          html += `<div class="data-item">`;
          html += `<div class="item-name">${itemName}</div>`;
          
          if (itemData.link) {
            html += `<a href="${itemData.link}" target="_blank" class="item-link">${itemData.link}</a>`;
          }
          
          if (itemData.desc && Array.isArray(itemData.desc)) {
            html += `<div class="item-desc">${itemData.desc.join(' / ')}</div>`;
          }
          
          if (itemData.error) {
            html += `<div class="item-error">错误: ${itemData.error}</div>`;
          } else {
            html += `<div class="item-stats">`;
            
            if (itemData.monthlyVisits !== undefined) {
              html += `<div class="stat-item">`;
              html += `<div class="stat-label">月访问量</div>`;
              html += `<div class="stat-value visits">${itemData.monthlyVisits}</div>`;
              html += `</div>`;
            }
            
            if (itemData.monthlyVisitsRaw !== undefined) {
              html += `<div class="stat-item">`;
              html += `<div class="stat-label">原始数值</div>`;
              html += `<div class="stat-value raw">${itemData.monthlyVisitsRaw.toLocaleString()}</div>`;
              html += `</div>`;
            }
            
            if (itemData.updateTime) {
              html += `<div class="stat-item">`;
              html += `<div class="stat-label">更新时间</div>`;
              html += `<div class="stat-value time">${itemData.updateTime}</div>`;
              html += `</div>`;
            }
            
            html += `</div>`;
          }
          
          html += `</div>`;
        });
      }
      
      html += `</div>`;
    });
    
    prettyView.innerHTML = html;
    
    // 绑定Tab切换事件
    const categoryTabs = prettyView.querySelectorAll('.category-tab');
    const categoryContents = prettyView.querySelectorAll('.category-content');
    
    categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const categoryName = tab.dataset.category;
        
        // 更新Tab状态
        categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // 更新内容显示
        categoryContents.forEach(content => {
          if (content.dataset.category === categoryName) {
            content.classList.add('active');
      } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

  // 复制JSON到剪贴板
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', async () => {
    try {
      const jsonText = jsonView.textContent;
      if (!jsonText || jsonText.trim() === '') {
        copyStatus.textContent = '没有可复制的内容';
        copyStatus.style.color = '#ea4335';
        setTimeout(() => {
          copyStatus.textContent = '';
        }, 2000);
        return;
      }
      
      await navigator.clipboard.writeText(jsonText);
      copyStatus.textContent = '✓ 已复制到剪贴板';
      copyStatus.style.color = '#34a853';
      
      setTimeout(() => {
        copyStatus.textContent = '';
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
      copyStatus.textContent = '复制失败';
      copyStatus.style.color = '#ea4335';
      setTimeout(() => {
        copyStatus.textContent = '';
      }, 2000);
    }
    });
  }

  // 视图切换
  if (viewButtons && viewButtons.length > 0) {
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (view === 'pretty') {
          if (prettyView) prettyView.classList.remove('hidden');
          if (jsonViewContainer) jsonViewContainer.classList.add('hidden');
        } else {
          if (prettyView) prettyView.classList.add('hidden');
          if (jsonViewContainer) jsonViewContainer.classList.remove('hidden');
        }
      });
    });
  }

  // 更新显示（同时更新JSON和美化视图）
  function updateDisplay(dataSource) {
    if (!jsonView || !prettyView) {
      return;
    }
    
    // JSON视图显示过滤后的数据
    const filteredData = filterData(dataSource);
    const jsonStr = JSON.stringify(filteredData, null, 2);
    jsonView.textContent = jsonStr;
    renderPrettyView(dataSource);
  }

  // 初始化
  try {
    await loadSettings();
    updateMergeModeState(); // 初始化时检查输入状态
  } catch (error) {
    console.error('初始化失败:', error);
    if (progressInfo) {
      progressInfo.textContent = '初始化失败，请刷新页面重试';
      progressInfo.style.color = '#ff0000';
    }
  }
}); 
