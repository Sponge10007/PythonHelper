// 统一的后端配置入口（避免页面直接硬编码地址）
import { BACKEND_URL } from '../common/config.js';

globalThis.GLOBAL_BACKEND_URL = BACKEND_URL;

export { BACKEND_URL };
