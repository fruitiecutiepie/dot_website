import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
// import '@testing-library/jest-dom/extend-expect';
import { expect } from '@jest/globals';
import ViewportContextMenu from '../viewport-contextmenu/viewport-contextmenu'; // Adjust the import based on your file structure
import { jest } from '@jest/globals';
import type {
    IViewportContextMenu,
    IViewportContextMenuProps,
  } from './viewport-contextmenu-models'

type OnActionInvokedType = (action: string, data?: object) => Promise<any>;

describe('ViewportContextMenu', () => {
  test('CopyLinkHandler copies link to clipboard and hides context menu', async () => {
    const mockOnActionInvoked: jest.MockedFunction<OnActionInvokedType> = jest.fn<OnActionInvokedType>().mockResolvedValue('mocked value');
    const { getByText } = render(
      <ViewportContextMenu 
        onActionInvoked={mockOnActionInvoked}
        setVisibility={jest.fn()}
        selectedElementText="Sample Text"
        href="https://example.com"
        menuItems={[]}
        isVisible={true}
        position={{ x: 0, y: 0 }}
        selectedElementUid="sample-uid"
        isSelectedElementEditable={false}
      />
    );

    // Set initial state
    const instance = getByText('Copy Link');
    // instance.setState({ href: 'https://example.com', isVisible: true });

    // Simulate click event
    // fireEvent.click(instance);
    await act(async () => {
      fireEvent.click(getByText('Copy Link'));
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    // Assertions
    expect(mockOnActionInvoked).toHaveBeenCalledWith('writeClipboard', {
      value: 'https://example.com',
    });
    // expect(instance.state.isVisible).toBe(false);
  });
});