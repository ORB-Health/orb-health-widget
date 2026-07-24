(() => {
    "use strict";

    class OrbWidget {
        constructor(options) {
            this.options = {
                target: document.body,
                token: null,
                baseUrl: './app,orb./embedlogin',
                position: 'bottom-right',
                draggable: true,
                ...options
            };

            this.iframe = null;
            this.container = null;
            this.header = null;
            this.titleElement = null;
            this.isOpen = false;
            this.currentPatient = null;
            this.currentSignatory = this.options.signatory || null;

            this.isDragging = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.containerStartX = 0;
            this.containerStartY = 0;

            this.init();
        }

        init() {
            window.addEventListener('message', this.handleMessage.bind(this));
        }

        open(patient = null) {
            if (!this.options.token) {
                console.error('No authentication token provided');
                return;
            }

            if (patient) {
                this.currentPatient = patient;
            }

            if (this.isOpen) {
                if (patient) {
                    this.updatePatient(patient);
                }
                return;
            }

            this.createFloatingWindow();
            this.isOpen = true;
        }

        createFloatingWindow() {
            const container = document.createElement('div');
            container.id = 'orb-widget-container';
            
            const initialPosition = this.getInitialPosition();

            // Contract is a document; the patient view stays phone-shaped.
            const isContract = String(this.options.baseUrl || '').includes('organisation-contract');
            const widgetWidth = this.options.width || (isContract ? 560 : 428);
            const widgetHeight = this.options.height || (isContract ? 860 : 926);

            container.style.cssText = `
                position: fixed;
                ${initialPosition};
                width: ${widgetWidth}px;
                height: ${widgetHeight}px;
                max-width: calc(100vw - 48px);
                max-height: calc(100vh - 48px);
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;

            const header = document.createElement('div');
            header.id = 'orb-widget-header';
            header.style.cssText = `
                color: white;
                background: linear-gradient(135deg, #1a2533, #334155);
                padding: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                cursor: ${this.options.draggable ? 'move' : 'default'};
                user-select: none;
            `;

            const leftSide = document.createElement('div');
            leftSide.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            `;

            const iconContainer = document.createElement('div');
            iconContainer.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                background: rgba(255, 255, 255, 0.2); 
                border-radius: 8px; 
                padding: 1px;
            `;
            iconContainer.innerHTML = `
                <svg width="40" height="40" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M245.729 304C279.319 304 306.549 276.749 306.549 243.134C306.549 209.519 279.319 182.269 245.729 182.269C212.139 182.269 184.909 209.519 184.909 243.134C184.909 276.749 212.139 304 245.729 304Z" fill="#F5450A"/>
                    <path d="M138.634 165.985C156.327 165.985 170.671 151.63 170.671 133.923C170.671 116.216 156.327 101.862 138.634 101.862C120.94 101.862 106.596 116.216 106.596 133.923C106.596 151.63 120.94 165.985 138.634 165.985Z" fill="#F5450A"/>
                    <path d="M327.055 130.035C343.906 130.035 357.567 116.364 357.567 99.5001C357.567 82.6363 343.906 68.9656 327.055 68.9656C310.204 68.9656 296.544 82.6363 296.544 99.5001C296.544 116.364 310.204 130.035 327.055 130.035Z" fill="#F5450A"/>
                    <path d="M394.42 296.264C414.642 296.264 431.034 279.859 431.034 259.622C431.034 239.386 414.642 222.981 394.42 222.981C374.199 222.981 357.806 239.386 357.806 259.622C357.806 279.859 374.199 296.264 394.42 296.264Z" fill="#F5450A"/>
                    <path d="M276.443 429.598C296.665 429.598 313.057 413.193 313.057 392.956C313.057 372.72 296.665 356.315 276.443 356.315C256.222 356.315 239.829 372.72 239.829 392.956C239.829 413.193 256.222 429.598 276.443 429.598Z" fill="#F5450A"/>
                    <path d="M113.208 356.316C137.642 356.316 157.45 336.494 157.45 312.041C157.45 287.589 137.642 267.766 113.208 267.766C88.7734 267.766 68.9656 287.589 68.9656 312.041C68.9656 336.494 88.7734 356.316 113.208 356.316Z" fill="#F5450A"/>
                </svg>
            `;

            const title = document.createElement('h3');
            title.id = 'orb-widget-title';
            title.textContent = this.getTitle();
            title.style.cssText = 'margin: 0; font-size: 20px; font-weight: 500; flex: 1; font-family: Arial;';

            leftSide.appendChild(iconContainer);
            leftSide.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: transparent;
                border: none;
                color: #FFF;
                font-size: 32px;
                line-height: 1;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background 0.2s;
                margin-left: 8px;
                flex-shrink: 0;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'transparent';
            });
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });

            header.appendChild(leftSide);
            header.appendChild(closeBtn);

            if (this.options.draggable) {
                header.addEventListener('mousedown', this.startDrag.bind(this));
            }

            const iframe = document.createElement('iframe');
            iframe.id = 'orb-widget-iframe';
            iframe.allow = 'clipboard-write';
            iframe.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                flex: 1;
            `;
            
            iframe.src = this.buildIframeUrl();

            container.appendChild(header);
            container.appendChild(iframe);

            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.95) translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `;
            if (!document.getElementById('orb-widget-animations')) {
                style.id = 'orb-widget-animations';
                document.head.appendChild(style);
            }

            document.body.appendChild(container);
            
            this.container = container;
            this.header = header;
            this.titleElement = title;
            this.iframe = iframe;

            iframe.addEventListener('load', () => {
                this.sendMessage({
                    type: 'SET_TOKEN',
                    token: this.options.token
                });

                if (this.currentPatient) {
                    this.sendMessage({
                        type: 'SET_PATIENT',
                        patient: this.currentPatient
                    });
                }

                if (this.currentSignatory) {
                    this.sendMessage({
                        type: 'SET_SIGNATORY',
                        signatory: this.currentSignatory
                    });
                }
            });
        }

        getTitle() {
            if (this.currentPatient) {
                const firstName = this.currentPatient.first_name || '';
                const lastName = this.currentPatient.last_name || '';
                
                if (firstName || lastName) {
                    return `${firstName} ${lastName}`.trim();
                }
            }
            return this.options.title || 'NHS Records';
        }

        updateTitle() {
            if (this.titleElement) {
                this.titleElement.textContent = this.getTitle();
            }
        }

        getInitialPosition() {
            const positions = {
                'bottom-right': 'bottom: 24px; right: 24px;',
                'bottom-left': 'bottom: 24px; left: 24px;',
                'top-right': 'top: 24px; right: 24px;',
                'top-left': 'top: 24px; left: 24px;'
            };
            return positions[this.options.position] || positions['bottom-right'];
        }

        startDrag(e) {
            e.preventDefault();
            
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            
            const rect = this.container.getBoundingClientRect();
            this.containerStartX = rect.left;
            this.containerStartY = rect.top;

            this.container.style.bottom = 'auto';
            this.container.style.right = 'auto';
            this.container.style.left = `${rect.left}px`;
            this.container.style.top = `${rect.top}px`;

            document.addEventListener('mousemove', this.drag.bind(this));
            document.addEventListener('mouseup', this.stopDrag.bind(this));

            document.body.style.userSelect = 'none';
            this.container.style.transition = 'none';
        }

        drag(e) {
            if (!this.isDragging) return;

            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;

            let newLeft = this.containerStartX + deltaX;
            let newTop = this.containerStartY + deltaY;

            const rect = this.container.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            this.container.style.left = `${newLeft}px`;
            this.container.style.top = `${newTop}px`;
        }

        stopDrag() {
            if (!this.isDragging) return;

            this.isDragging = false;
            document.removeEventListener('mousemove', this.drag);
            document.removeEventListener('mouseup', this.stopDrag);
            
            document.body.style.userSelect = '';
        }

        close() {
            if (!this.isOpen) return;

            if (this.container && this.container.parentNode) {
                this.container.remove();
            }

            this.container = null;
            this.header = null;
            this.titleElement = null;
            this.iframe = null;
            this.isOpen = false;
        }

        setPatient(patient) {
            this.currentPatient = patient;
            this.updatePatient(patient);
        }

        setSignatory(signatory) {
            this.currentSignatory = signatory;

            if (this.iframe && signatory) {
                this.sendMessage({
                    type: 'SET_SIGNATORY',
                    signatory: signatory
                });
            }
        }

        refreshToken(newToken) {
            this.options.token = newToken;
            this.sendMessage({ type: 'SET_TOKEN', token: newToken });
        }

        updatePatient(patient) {
            this.currentPatient = patient;
            this.updateTitle();
            
            if (this.iframe) {
                this.sendMessage({
                    type: 'SET_PATIENT',
                    patient: patient
                });
            }
        }

        getWidgetOrigin() {
            try {
                return new URL(this.options.baseUrl, window.location.href).origin;
            } catch (e) {
                return window.location.origin;
            }
        }

        buildIframeUrl(path = '') {
            try {
                const url = new URL(this.options.baseUrl, window.location.href);
                const routePath = String(path || '').replace(/^\/+/, '');

                if (routePath) {
                    const routedUrl = new URL(routePath, `${url.origin}${url.pathname.replace(/\/?$/, '/')}`);
                    url.pathname = routedUrl.pathname;

                    routedUrl.searchParams.forEach((value, key) => {
                        url.searchParams.set(key, value);
                    });
                }

                url.searchParams.set('parentOrigin', window.location.origin);
                return url.toString();
            } catch (e) {
                const rawUrl = `${this.options.baseUrl}${path}`;
                const separator = rawUrl.includes('?') ? '&' : '?';
                return `${rawUrl}${separator}parentOrigin=${encodeURIComponent(window.location.origin)}`;
            }
        }

        sendMessage(message) {
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage(
                    message,
                    this.getWidgetOrigin()
                );
            }
        }

        handleMessage(event) {
            if (this.iframe && event.source !== this.iframe.contentWindow) {
                return;
            }

            if (this.iframe && event.origin !== this.getWidgetOrigin()) return;

            const { type, data } = event.data || {};

            switch (type) {
                case 'NAVIGATE':
                    if (this.iframe) {
                        this.iframe.src = this.buildIframeUrl(data.url);
                    }
                    break;

                case 'CLOSE':
                    this.close();
                    break;

                case 'READY':
                    console.log('Widget iframe ready');
                    // Re-send token, patient and signatory now that the iframe app is ready to receive
                    if (this.options.token) {
                        this.sendMessage({ type: 'SET_TOKEN', token: this.options.token });
                    }
                    if (this.currentPatient) {
                        this.sendMessage({ type: 'SET_PATIENT', patient: this.currentPatient });
                    }
                    if (this.currentSignatory) {
                        this.sendMessage({ type: 'SET_SIGNATORY', signatory: this.currentSignatory });
                    }
                    break;

                case 'REFRESH_TOKEN':
                    window.dispatchEvent(new CustomEvent('orb-widget-token-refresh', {
                        detail: { patient: this.currentPatient }
                    }));
                    break;

                case 'CONTRACT_SIGNED':
                    window.dispatchEvent(new CustomEvent('orb-widget-contract-signed', {
                        detail: { signedContractUrl: data && data.signedContractUrl }
                    }));
                    break;

                default:
                    if (type) console.log('Unknown message type:', type);
            }
        }

        setToken(token) {
            this.options.token = token;
        }

        destroy() {
            this.close();
            window.removeEventListener('message', this.handleMessage);
        }
    }

    window.OrbWidget = OrbWidget;

    if (window.orbWidgetOptions) {
        new OrbWidget(window.orbWidgetOptions);
    }
})();