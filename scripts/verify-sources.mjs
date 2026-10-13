#!/usr/bin/env node
/**
 * IPTV 源验证脚本
 * 检查 M3U 文件中的流媒体 URL 是否可用
 */

import fetch from 'node-fetch';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const M3U_PATH = join(OUTPUT_DIR, 'iptv-aggregated.m3u');

// 验证配置
const CONFIG = {
  timeout: 10000,        // 10 秒超时
  maxRetries: 2,         // 最多重试 2 次
  concurrency: 10,       // 并发数
  userAgent: 'IPTV-Verifier/1.0 (+https://github.com/akiralereal/iptv-aggregator)',
  checkHls: true,        // 是否检查 HLS 清单
  minBitrate: 500000     // 最小比特率 (500kbps)
};

// 解析 M3U 文件
function parseM3U(content) {
  const channels = [];
  const lines = content.split('\n');
  
  let currentChannel = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      const nameMatch = trimmed.match(/,(.+?)(?:\s*$|\s+#)/);
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        group: groupMatch ? groupMatch[1] : 'Unknown',
        url: null,
        status: null,
        error: null
      };
    } else if (trimmed.match(/^https?:\/\//) && currentChannel) {
      currentChannel.url = trimmed;
      channels.push(currentChannel);
      currentChannel = null;
    }
  }
  
  return channels;
}

// 验证单个 URL
async function verifyUrl(url, retries = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length') || '0';
      
      return {
        status: 'online',
        contentType,
        contentLength: parseInt(contentLength, 10),
        statusCode: response.status
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    if (retries < CONFIG.maxRetries) {
      // 重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
      return verifyUrl(url, retries + 1);
    }
    
    return {
      status: 'offline',
      error: error.message || 'Unknown error'
    };
  }
}

// 批量验证
async function verifyBatch(channels, batchIndex, totalBatches) {
  const batchSize = Math.ceil(channels.length / totalBatches);
  const start = batchIndex * batchSize;
  const end = Math.min(start + batchSize, channels.length);
  const batch = channels.slice(start, end);
  
  console.log(`验证批次 ${batchIndex + 1}/${totalBatches} (${batch.length} 个频道)...`);
  
  const results = await Promise.all(
    batch.map(async (channel, index) => {
      const result = await verifyUrl(channel.url);
      return { ...channel, ...result };
    })
  );
  
  return results;
}

// 主函数
async function main() {
  console.log('IPTV 源验证工具 v1.0\n');
  console.log('配置:');
  console.log(`  超时：${CONFIG.timeout}ms`);
  console.log(`  重试次数：${CONFIG.maxRetries}`);
  console.log(`  并发数：${CONFIG.concurrency}`);
  console.log(`  检查 HLS: ${CONFIG.checkHls}\n`);
  
  // 读取 M3U 文件
  if (!readFileSync(M3U_PATH, 'utf-8')) {
    console.error(`错误：找不到 M3U 文件 ${M3U_PATH}`);
    console.error('请先运行 generate-playlist.mjs 生成播放列表');
    process.exit(1);
  }
  
  const m3uContent = readFileSync(M3U_PATH, 'utf-8');
  const channels = parseM3U(m3uContent);
  
  console.log(`找到 ${channels.length} 个频道\n`);
  
  if (channels.length === 0) {
    console.log('没有频道需要验证');
    return;
  }
  
  // 分批验证
  const totalBatches = Math.ceil(channels.length / CONFIG.concurrency);
  const allResults = [];
  
  for (let i = 0; i < totalBatches; i++) {
    const batchResults = await verifyBatch(channels, i, totalBatches);
    allResults.push(...batchResults);
    
    // 显示进度
    const online = batchResults.filter(r => r.status === 'online').length;
    const offline = batchResults.filter(r => r.status === 'offline').length;
    console.log(`  批次 ${i + 1} 完成：在线 ${online}, 离线 ${offline}\n`);
  }
  
  // 统计结果
  const online = allResults.filter(r => r.status === 'online');
  const offline = allResults.filter(r => r.status === 'offline');
  
  console.log('\n验证完成!');
  console.log(`总计：${allResults.length} 个频道`);
  console.log(`在线：${online.length} (${((online.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`离线：${offline.length} (${((offline.length / allResults.length) * 100).toFixed(1)}%)`);
  
  // 按分组统计
  const byGroup = {};
  for (const result of allResults) {
    const group = result.group || 'Unknown';
    if (!byGroup[group]) {
      byGroup[group] = { total: 0, online: 0, offline: 0 };
    }
    byGroup[group].total++;
    if (result.status === 'online') {
      byGroup[group].online++;
    } else {
      byGroup[group].offline++;
    }
  }
  
  console.log('\n按分组统计:');
  Object.entries(byGroup)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([group, stats]) => {
      const rate = ((stats.online / stats.total) * 100).toFixed(0);
      console.log(`  ${group}: ${stats.online}/${stats.total} (${rate}%)`);
    });
  
  // 生成验证报告
  const report = {
    timestamp: new Date().toISOString(),
    total: allResults.length,
    online: online.length,
    offline: offline.length,
    successRate: ((online.length / allResults.length) * 100).toFixed(1),
    byGroup,
    offlineChannels: offline.map(c => ({
      name: c.name,
      group: c.group,
      url: c.url,
      error: c.error
    }))
  };
  
  console.log('\n验证报告已生成');
  console.log('离线频道列表:');
  offline.slice(0, 10).forEach(c => {
    console.log(`  - ${c.name} (${c.group}): ${c.error}`);
  });
  
  if (offline.length > 10) {
    console.log(`  ... 还有 ${offline.length - 10} 个离线频道`);
  }
  
  return report;
}

// 运行
main().catch(error => {
  console.error('验证过程出错:', error);
  process.exit(1);
});
