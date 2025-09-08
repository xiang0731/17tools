/**
 * 17Tools 认证管理模块
 * 用于管理研发中工具的访问权限
 * 
 * @author 17Tools Team
 * @version 2.2.0
 */

class PasswordManager {
    constructor() {
        // 访问密码 - 可根据需要修改
        this.correctPassword = 'dddd';
        this.sessionKey = 'devToolsAuthenticated';
        this.init();
    }

    init() {
        // 检查会话状态
        this.isAuthenticated = sessionStorage.getItem(this.sessionKey) === 'true';
    }

    /**
     * 显示密码验证模态框
     * @param {Function} callback - 验证成功后的回调函数
     */
    showPasswordModal(callback) {
        const overlay = document.createElement('div');
        overlay.className = 'password-overlay';
        overlay.innerHTML = `
            <div class="password-modal">
                <h3>🔒 访问受限</h3>
                <p>此功能正在研发中，请输入访问密码</p>
                <input type="password" class="password-input" placeholder="请输入密码" id="password-input">
                <div class="password-error" id="password-error">密码错误，请重新输入</div>
                <div class="password-buttons">
                    <button class="password-btn secondary" id="cancel-btn">取消</button>
                    <button class="password-btn primary" id="confirm-btn">确认</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const passwordInput = document.getElementById('password-input');
        const errorDiv = document.getElementById('password-error');
        const cancelBtn = document.getElementById('cancel-btn');
        const confirmBtn = document.getElementById('confirm-btn');

        // 聚焦到输入框
        passwordInput.focus();

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // 确认按钮
        const handleConfirm = () => {
            const inputPassword = passwordInput.value.trim();
            if (this.validatePassword(inputPassword)) {
                this.isAuthenticated = true;
                sessionStorage.setItem(this.sessionKey, 'true');
                document.body.removeChild(overlay);
                callback();
            } else {
                this.showError(errorDiv);
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);

        // 回车键确认
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            }
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    /**
     * 验证密码
     * @param {string} inputPassword - 用户输入的密码
     * @returns {boolean} - 验证结果
     */
    validatePassword(inputPassword) {
        return inputPassword === this.correctPassword;
    }

    /**
     * 显示错误信息
     * @param {HTMLElement} errorDiv - 错误信息显示元素
     */
    showError(errorDiv) {
        errorDiv.style.display = 'block';

        // 3秒后隐藏错误信息
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }

    /**
     * 检查访问权限
     * @param {Function} callback - 验证通过后的回调函数
     */
    checkAccess(callback) {
        if (this.isAuthenticated) {
            callback();
        } else {
            this.showPasswordModal(callback);
        }
    }

    /**
     * 更新受保护项目的显示名称
     * 根据认证状态显示不同的名称
     */
    updateProtectedItemNames() {
        const protectedItems = document.querySelectorAll('[data-protected="true"]');
        protectedItems.forEach(item => {
            const span = item.querySelector('span');
            if (this.isAuthenticated) {
                // 如果已认证，显示真实名称
                const fileName = item.getAttribute('data-file');
                if (fileName === 'DevTool1.html') {
                    span.textContent = '新功能预览';
                } else if (fileName === 'DevTool2.html') {
                    span.textContent = '实验性工具';
                } else if (fileName === 'Keeper.html') {
                    span.textContent = '防息屏工具';
                } else if (fileName === 'WifiQRCode.html') {
                    span.textContent = 'WiFi二维码';
                }
            } else {
                // 如果未认证，显示"敬请期待"
                span.textContent = '敬请期待';
            }
        });
    }

    /**
     * 重置认证状态（可用于调试或管理）
     */
    resetAuth() {
        this.isAuthenticated = false;
        sessionStorage.removeItem(this.sessionKey);
        this.updateProtectedItemNames();
        console.log('认证状态已重置');
    }

    /**
     * 获取当前认证状态
     * @returns {boolean} - 当前认证状态
     */
    getAuthStatus() {
        return this.isAuthenticated;
    }
}

// 导出到全局作用域，供主页面使用
window.PasswordManager = PasswordManager;
