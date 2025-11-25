/**
 * Design System Interactive Demo
 * Provides interactivity for component demonstrations
 */

class DesignSystemDemo {
    constructor() {
        this.init();
    }

    init() {
        this.setupCopyButtons();
        this.setupModalDemo();
        this.setupToastDemo();
        this.setupDropdownDemo();
        this.setupSmoothScroll();
    }

    /**
     * Setup copy-to-clipboard functionality for code snippets
     */
    setupCopyButtons() {
        const copyButtons = document.querySelectorAll('.ds-copy-btn');

        copyButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const codeId = button.getAttribute('data-copy');
                const codeElement = document.getElementById(`code-${codeId}`);

                if (codeElement) {
                    try {
                        await navigator.clipboard.writeText(codeElement.textContent);

                        // Visual feedback
                        button.textContent = 'Copied!';
                        button.classList.add('copied');

                        setTimeout(() => {
                            button.textContent = 'Copy HTML';
                            button.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy:', err);
                        this.showToast('Failed to copy to clipboard', 'error');
                    }
                }
            });
        });
    }

    /**
     * Setup modal demonstration
     */
    setupModalDemo() {
        const modalTrigger = document.getElementById('demo-modal-trigger');
        const modal = document.getElementById('demo-modal');
        const closeBtn = document.getElementById('demo-modal-close');
        const cancelBtn = document.getElementById('demo-modal-cancel');

        if (modalTrigger && modal) {
            modalTrigger.addEventListener('click', () => {
                modal.classList.add('visible');
            });

            const closeModal = () => {
                modal.classList.remove('visible');
            };

            closeBtn?.addEventListener('click', closeModal);
            cancelBtn?.addEventListener('click', closeModal);

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('visible')) {
                    closeModal();
                }
            });
        }
    }

    /**
     * Setup toast notification demonstrations
     */
    setupToastDemo() {
        const toastButtons = [
            { id: 'demo-toast-success', type: 'success', message: 'Successfully saved your changes!' },
            { id: 'demo-toast-error', type: 'error', message: 'Something went wrong. Please try again.' },
            { id: 'demo-toast-warning', type: 'warning', message: 'Warning: This action cannot be undone.' },
            { id: 'demo-toast-info', type: 'info', message: 'New update available!' }
        ];

        toastButtons.forEach(({ id, type, message }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    this.showToast(message, type);
                });
            }
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Setup dropdown menu demonstration
     */
    setupDropdownDemo() {
        const trigger = document.getElementById('demo-dropdown-trigger');
        const dropdown = document.getElementById('demo-dropdown');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('visible');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('visible');
                }
            });

            // Close dropdown when clicking an item
            const items = dropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.addEventListener('click', () => {
                    dropdown.classList.remove('visible');
                    this.showToast('Dropdown item clicked!', 'info');
                });
            });
        }
    }

    /**
     * Setup smooth scrolling for navigation links
     */
    setupSmoothScroll() {
        const navLinks = document.querySelectorAll('.ds-nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    const offset = 100; // Account for sticky nav
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    // Update URL without jumping
                    history.pushState(null, null, targetId);
                }
            });
        });
    }

    /**
     * Highlight active navigation link based on scroll position
     */
    highlightActiveNav() {
        const sections = document.querySelectorAll('.ds-section');
        const navLinks = document.querySelectorAll('.ds-nav-link');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.style.background = '';
                        link.style.color = '';

                        if (link.getAttribute('href') === `#${id}`) {
                            link.style.background = 'var(--surface-hover)';
                            link.style.color = 'var(--text-primary)';
                        }
                    });
                }
            });
        }, {
            rootMargin: '-150px 0px -50% 0px'
        });

        sections.forEach(section => {
            observer.observe(section);
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new DesignSystemDemo();
    });
} else {
    new DesignSystemDemo();
}

// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Alt + C to copy focused code block
    if (e.altKey && e.key === 'c') {
        const focusedButton = document.activeElement;
        if (focusedButton && focusedButton.classList.contains('ds-copy-btn')) {
            focusedButton.click();
        }
    }
});

// Add search functionality (bonus feature)
const addSearchFeature = () => {
    // Create search input
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: none;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'input';
    searchInput.placeholder = 'Search components...';
    searchInput.style.cssText = `
        width: 250px;
        background: var(--surface-elevated);
        border: 2px solid var(--border);
    `;

    searchContainer.appendChild(searchInput);
    document.body.appendChild(searchContainer);

    // Toggle search with Ctrl/Cmd + K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchContainer.style.display = searchContainer.style.display === 'none' ? 'block' : 'none';
            if (searchContainer.style.display === 'block') {
                searchInput.focus();
            }
        }

        // Close search on Escape
        if (e.key === 'Escape') {
            searchContainer.style.display = 'none';
        }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const sections = document.querySelectorAll('.ds-section');

        sections.forEach(section => {
            const title = section.querySelector('.ds-section-title').textContent.toLowerCase();
            const subsections = section.querySelectorAll('.ds-subsection-title');
            let hasMatch = title.includes(query);

            subsections.forEach(sub => {
                if (sub.textContent.toLowerCase().includes(query)) {
                    hasMatch = true;
                }
            });

            section.style.display = hasMatch || query === '' ? 'block' : 'none';
        });
    });
};

// Initialize search feature
addSearchFeature();

// Design system loaded successfully
// Keyboard shortcuts: Ctrl/Cmd + K (search), Alt + C (copy code)
