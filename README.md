这是一个功能强大的 Chrome 浏览器扩展，用于批量获取 SimilarWeb Pro 网站流量数据。

## 使用说明

第一步：登录 https://pro.similarweb.com/

第二步：安装浏览器拓展插件

1. 在 Chrome 浏览器中打开 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录（也可以直接将文件夹拖过来）

[](./assets/rk.png)

[](./assets/ext.png)


第三步：点击开始即可

[](./assets/start.png)

[](./assets/page.png)


## 其他说明

### 手动执行
1. 打开插件，切换到"手动执行"标签
2. 输入域名数据（支持三种格式）
3. 点击"立即执行"
4. 实时查看进度和结果

### 管理数据源
1. 切换到"数据源管理"标签
2. 输入自定义JSON数据源
3. 选择合并方式
4. 点击"保存数据源"
5. 可以点击"预览合并结果"查看效果

## 主要功能

### 1. 手动执行
- 支持三种输入格式：
  - 单个域名：`pptfans.cn`
  - 域名数组：`["pptfans.cn", "example.com"]`
  - 嵌套JSON格式（与 sourcedata.json 相同）


### 2. 数据源管理
- 基础数据源：使用 `sourcedata.json` 作为默认数据源
- 自定义数据源：支持添加自定义JSON数据源
- 合并方式：
  - **合并模式**：保留基础数据，自定义数据补充
  - **覆盖模式**：自定义数据优先，覆盖基础数据

### 3. 数据字段
- `monthlyVisits`：格式化后的访问量（如：27.4万）
- `monthlyVisitsRaw`：原始数值（如：274000）
- `link`：网站链接
- `desc`：描述信息

## 注意事项

1. **需要 SimilarWeb Pro 账号**：必须先登录 SimilarWeb Pro 才能使用
2. **Cookie 认证**：插件会自动获取登录凭证
3. **API 限流**：插件已实现智能并发控制，避免触发限流，所以速度会比较慢
4. **数据存储**：所有数据保存在浏览器本地存储中

## 数据格式示例

```json
{
  "AI文本": {
    "5118": {
      "link": "https://www.5118.com/ai/articlegenius",
      "desc": ["高质量SEO文章/提高搜索"],
      "monthlyVisits": "27.4万",
      "monthlyVisitsRaw": 274000
    }
  }
}
```
