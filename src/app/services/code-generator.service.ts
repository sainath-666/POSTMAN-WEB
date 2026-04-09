import { Injectable } from '@angular/core';
import { ApiRequest, CodeLanguage } from '../models/api.models';

/**
 * CodeGeneratorService generates code snippets for requests in multiple languages.
 * Supports cURL, JavaScript Fetch/Axios, Python Requests, PHP, and C#.
 */
@Injectable({ providedIn: 'root' })
export class CodeGeneratorService {

  generate(request: ApiRequest, language: CodeLanguage): string {
    switch (language) {
      case 'curl': return this.generateCurl(request);
      case 'javascript-fetch': return this.generateFetch(request);
      case 'javascript-axios': return this.generateAxios(request);
      case 'python': return this.generatePython(request);
      case 'php': return this.generatePhp(request);
      case 'csharp': return this.generateCsharp(request);
      default: return '// Unsupported language';
    }
  }

  // ─── cURL ───
  private generateCurl(req: ApiRequest): string {
    const lines: string[] = [`curl -X ${req.method} '${req.url}'`];

    // Auth
    if (req.auth.type === 'basic') {
      lines.push(`  -u '${req.auth.basic.username}:${req.auth.basic.password}'`);
    } else if (req.auth.type === 'bearer') {
      lines.push(`  -H 'Authorization: ${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}'`);
    } else if (req.auth.type === 'apikey' && req.auth.apikey.addTo === 'header') {
      lines.push(`  -H '${req.auth.apikey.key}: ${req.auth.apikey.value}'`);
    }

    // Headers
    req.headers.filter((h) => h.enabled && h.key).forEach((h) => {
      lines.push(`  -H '${h.key}: ${h.value}'`);
    });

    // Body
    if (req.body.type === 'json' && req.body.raw) {
      lines.push(`  -H 'Content-Type: application/json'`);
      lines.push(`  -d '${req.body.raw}'`);
    } else if (req.body.type === 'urlencoded') {
      const params = req.body.urlEncoded.filter((p) => p.enabled && p.key)
        .map((p) => `${p.key}=${p.value}`).join('&');
      lines.push(`  -d '${params}'`);
    } else if (req.body.type === 'text' || req.body.type === 'xml' || req.body.type === 'html') {
      lines.push(`  -d '${req.body.raw}'`);
    } else if (req.body.type === 'graphql') {
      lines.push(`  -H 'Content-Type: application/json'`);
      const graphqlBody = JSON.stringify({ query: req.body.graphql.query, variables: req.body.graphql.variables });
      lines.push(`  -d '${graphqlBody}'`);
    }

    // Params
    const params = req.params.filter((p) => p.enabled && p.key);
    if (params.length > 0) {
      const qs = params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      lines[0] = `curl -X ${req.method} '${req.url}${req.url.includes('?') ? '&' : '?'}${qs}'`;
    }

    return lines.join(' \\\n');
  }

  // ─── JavaScript Fetch ───
  private generateFetch(req: ApiRequest): string {
    const headers: Record<string, string> = {};
    const options: any = { method: req.method };

    // Auth
    if (req.auth.type === 'basic') {
      headers['Authorization'] = `Basic \${btoa('${req.auth.basic.username}:${req.auth.basic.password}')}`;
    } else if (req.auth.type === 'bearer') {
      headers['Authorization'] = `${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}`;
    } else if (req.auth.type === 'apikey' && req.auth.apikey.addTo === 'header') {
      headers[req.auth.apikey.key] = req.auth.apikey.value;
    }

    // Headers
    req.headers.filter((h) => h.enabled && h.key).forEach((h) => {
      headers[h.key] = h.value;
    });

    let bodyStr = '';
    if (req.body.type === 'json' && req.body.raw) {
      headers['Content-Type'] = 'application/json';
      bodyStr = `  body: JSON.stringify(${req.body.raw}),\n`;
    } else if (req.body.type === 'urlencoded') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const params = req.body.urlEncoded.filter((p) => p.enabled && p.key)
        .map((p) => `${p.key}=${p.value}`).join('&');
      bodyStr = `  body: '${params}',\n`;
    } else if (req.body.type !== 'none' && req.body.raw) {
      bodyStr = `  body: \`${req.body.raw}\`,\n`;
    }

    let url = req.url;
    const params = req.params.filter((p) => p.enabled && p.key);
    if (params.length > 0) {
      const qs = params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }

    const headerStr = Object.keys(headers).length > 0
      ? `  headers: ${JSON.stringify(headers, null, 4)},\n`
      : '';

    return `const response = await fetch('${url}', {\n  method: '${req.method}',\n${headerStr}${bodyStr}});\n\nconst data = await response.json();\nconsole.log(data);`;
  }

  // ─── JavaScript Axios ───
  private generateAxios(req: ApiRequest): string {
    const headers: Record<string, string> = {};

    if (req.auth.type === 'bearer') {
      headers['Authorization'] = `${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}`;
    } else if (req.auth.type === 'apikey' && req.auth.apikey.addTo === 'header') {
      headers[req.auth.apikey.key] = req.auth.apikey.value;
    }
    req.headers.filter((h) => h.enabled && h.key).forEach((h) => (headers[h.key] = h.value));

    const config: any = {};
    if (Object.keys(headers).length > 0) config.headers = headers;

    const params = req.params.filter((p) => p.enabled && p.key);
    if (params.length > 0) {
      config.params = {};
      params.forEach((p) => (config.params[p.key] = p.value));
    }

    if (req.auth.type === 'basic') {
      config.auth = { username: req.auth.basic.username, password: req.auth.basic.password };
    }

    let bodyArg = '';
    if (req.body.type === 'json' && req.body.raw) {
      bodyArg = req.body.raw;
    } else if (req.body.type !== 'none' && req.body.raw) {
      bodyArg = `'${req.body.raw}'`;
    }

    const configStr = Object.keys(config).length > 0 ? `, ${JSON.stringify(config, null, 2)}` : '';
    const methodLower = req.method.toLowerCase();

    if (['get', 'delete', 'head', 'options'].includes(methodLower)) {
      return `const { data } = await axios.${methodLower}('${req.url}'${configStr});\nconsole.log(data);`;
    }
    return `const { data } = await axios.${methodLower}('${req.url}', ${bodyArg || 'null'}${configStr});\nconsole.log(data);`;
  }

  // ─── Python Requests ───
  private generatePython(req: ApiRequest): string {
    const lines: string[] = ['import requests', ''];

    let url = req.url;
    const methodLower = req.method.toLowerCase();

    const headers: Record<string, string> = {};
    req.headers.filter((h) => h.enabled && h.key).forEach((h) => (headers[h.key] = h.value));

    const kwargs: string[] = [];

    if (Object.keys(headers).length > 0) {
      kwargs.push(`    headers=${JSON.stringify(headers).replace(/"/g, "'")}`);
    }

    if (req.auth.type === 'basic') {
      kwargs.push(`    auth=('${req.auth.basic.username}', '${req.auth.basic.password}')`);
    } else if (req.auth.type === 'bearer') {
      headers['Authorization'] = `${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}`;
      kwargs[kwargs.findIndex((k) => k.includes('headers='))] = `    headers=${JSON.stringify(headers).replace(/"/g, "'")}`;
    }

    const params = req.params.filter((p) => p.enabled && p.key);
    if (params.length > 0) {
      const paramObj: Record<string, string> = {};
      params.forEach((p) => (paramObj[p.key] = p.value));
      kwargs.push(`    params=${JSON.stringify(paramObj).replace(/"/g, "'")}`);
    }

    if (req.body.type === 'json' && req.body.raw) {
      kwargs.push(`    json=${req.body.raw}`);
    } else if (req.body.type !== 'none' && req.body.raw) {
      kwargs.push(`    data='${req.body.raw}'`);
    }

    lines.push(`response = requests.${methodLower}(`);
    lines.push(`    '${url}',`);
    kwargs.forEach((k) => lines.push(`${k},`));
    lines.push(`)`);
    lines.push('');
    lines.push('print(response.status_code)');
    lines.push('print(response.json())');

    return lines.join('\n');
  }

  // ─── PHP cURL ───
  private generatePhp(req: ApiRequest): string {
    const lines = [
      '<?php',
      '$ch = curl_init();',
      '',
      `curl_setopt($ch, CURLOPT_URL, '${req.url}');`,
      'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
      `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${req.method}');`,
    ];

    const headers: string[] = [];

    if (req.auth.type === 'basic') {
      lines.push(`curl_setopt($ch, CURLOPT_USERPWD, '${req.auth.basic.username}:${req.auth.basic.password}');`);
    } else if (req.auth.type === 'bearer') {
      headers.push(`'Authorization: ${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}'`);
    }

    req.headers.filter((h) => h.enabled && h.key).forEach((h) => {
      headers.push(`'${h.key}: ${h.value}'`);
    });

    if (req.body.type === 'json' && req.body.raw) {
      headers.push("'Content-Type: application/json'");
      lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, '${req.body.raw.replace(/'/g, "\\'")}');`);
    }

    if (headers.length > 0) {
      lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [${headers.join(', ')}]);`);
    }

    lines.push('', '$response = curl_exec($ch);', 'curl_close($ch);', '', 'echo $response;');
    return lines.join('\n');
  }

  // ─── C# HttpClient ───
  private generateCsharp(req: ApiRequest): string {
    const lines = [
      'using System.Net.Http;',
      'using System.Text;',
      '',
      'var client = new HttpClient();',
    ];

    if (req.auth.type === 'bearer') {
      lines.push(`client.DefaultRequestHeaders.Add("Authorization", "${req.auth.bearer.prefix || 'Bearer'} ${req.auth.bearer.token}");`);
    }

    req.headers.filter((h) => h.enabled && h.key).forEach((h) => {
      lines.push(`client.DefaultRequestHeaders.Add("${h.key}", "${h.value}");`);
    });

    const methodMap: Record<string, string> = {
      GET: 'GetAsync', POST: 'PostAsync', PUT: 'PutAsync', DELETE: 'DeleteAsync', PATCH: 'PatchAsync',
    };

    if (req.body.type === 'json' && req.body.raw && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      lines.push(`var content = new StringContent(@"${req.body.raw.replace(/"/g, '""')}", Encoding.UTF8, "application/json");`);
      lines.push(`var response = await client.${methodMap[req.method] || 'PostAsync'}("${req.url}", content);`);
    } else {
      lines.push(`var response = await client.${methodMap[req.method] || 'GetAsync'}("${req.url}");`);
    }

    lines.push('var body = await response.Content.ReadAsStringAsync();');
    lines.push('Console.WriteLine(body);');

    return lines.join('\n');
  }
}
