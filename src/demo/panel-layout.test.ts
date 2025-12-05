import { test, it, describe, beforeEach } from 'node:test';
import * as assert from 'node:assert';

// Mock DOM elements for testing
class MockStyle {
    width: string = '';
    height: string = '';
    minWidth: string = '';
    minHeight: string = '';
    maxWidth: string = '';
    maxHeight: string = '';
}

class MockElement {
    style = new MockStyle();
    id: string;
    
    constructor(id: string) {
        this.id = id;
    }
    
    getBoundingClientRect() {
        return { width: 600, height: 500, top: 20, left: 20 };
    }
}

// The function to be implemented in the renderer
function lockPanelDimensions(panelElement: any) {
    if (!panelElement) return;
    
    // Enforce fixed width
    panelElement.style.width = '600px';
    panelElement.style.minWidth = '600px';
    panelElement.style.maxWidth = '600px';
    
    // Prevent height from collapsing too much (optional, based on user request for consistency)
    // We'll set a reasonable min-height
    panelElement.style.minHeight = '200px';
}

describe('Panel Layout Locking', () => {
    it('should enforce fixed width on the panel', () => {
        const panel = new MockElement('mainPanel');
        
        // Initial state
        panel.style.width = 'auto';
        
        // Apply lock
        lockPanelDimensions(panel);
        
        assert.strictEqual(panel.style.width, '600px');
        assert.strictEqual(panel.style.minWidth, '600px');
        assert.strictEqual(panel.style.maxWidth, '600px');
    });

    it('should set minimum height to prevent collapse', () => {
        const panel = new MockElement('mainPanel');
        lockPanelDimensions(panel);
        assert.strictEqual(panel.style.minHeight, '200px');
    });
    
    it('should handle missing element gracefully', () => {
        assert.doesNotThrow(() => lockPanelDimensions(null));
        assert.doesNotThrow(() => lockPanelDimensions(undefined));
    });
});
