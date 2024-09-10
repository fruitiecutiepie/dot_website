import EventEmitterEnhancer, { EnhancedEventEmitter } from 'event-emitter-enhancer'
import { Browser, CDPSession, Page } from 'puppeteer-core'
import { Clipboard } from './Clipboard'
import { isDarkTheme } from './Config'

type ActionData = {
  value?: any,

  accept?: boolean,
  promptText?: string | undefined,
}

enum ExposedFunc {
  EmitCopy = 'EMIT_DOTWEBSITE_ON_COPY',
  GetPaste = 'EMIT_DOTWEBSITE_GET_PASTE',
  EnableCopyPaste = 'ENABLE_DOTWEBSITE_HOOK_COPY_PASTE',

  EmitContextMenu = 'EMIT_DOTWEBSITE_ON_CONTEXT_MENU',
  EmitSelection = 'EMIT_DOTWEBSITE_ON_MOUSE_UP',
  EmitClick = 'EMIT_DOTWEBSITE_ON_CLICK',
  EmitSelectAll = 'EMIT_DOTWEBSITE_ON_SELECT_ALL',
  
  EmitFindSearchBarQuery = 'EMIT_DOTWEBSITE_ON_FIND_SEARCH_BAR_QUERY',
  RemoveAllHighlights = 'EMIT_DOTWEBSITE_REMOVE_ALL_HIGHLIGHTS',
  UpdateHighlights = 'EMIT_DOTWEBSITE_UPDATE_HIGHLIGHTS',
}

export class BrowserPage extends EnhancedEventEmitter {
  private client: CDPSession
  private clipboard: Clipboard

  constructor(
    public readonly browser: Browser,
    public readonly page: Page,
  ) {
    super()
    this.clipboard = new Clipboard()
    this.removeAllHighlights = this.removeAllHighlights.bind(this)
    this.updateHighlights = this.updateHighlights.bind(this)
    this.scrollToHighlightedMatch = this.scrollToHighlightedMatch.bind(this)
  }

  get id(): string {
    return this.page.mainFrame()._id
  }

  public dispose() {
    this.removeAllElseListeners()
    // @ts-expect-error
    this.removeAllListeners()
    this.client.detach()
    Promise.allSettled([
      this.page.removeExposedFunction(ExposedFunc.EnableCopyPaste),
      this.page.removeExposedFunction(ExposedFunc.EmitCopy),
      this.page.removeExposedFunction(ExposedFunc.GetPaste),
      
      this.page.removeExposedFunction(ExposedFunc.EmitContextMenu),
      this.page.removeExposedFunction(ExposedFunc.EmitSelection),
      this.page.removeExposedFunction(ExposedFunc.EmitClick),
      this.page.removeExposedFunction(ExposedFunc.EmitSelectAll),

      this.page.removeExposedFunction(ExposedFunc.EmitFindSearchBarQuery),
      this.page.removeExposedFunction(ExposedFunc.RemoveAllHighlights),
      this.page.removeExposedFunction(ExposedFunc.UpdateHighlights),
    ]).then(() => {
      this.page.close()
    })
  }

  public async send(action: string, data: ActionData = {}, callbackId?: number) {
    // console.log('► browserPage.send', action)
    switch (action) {
      case 'Page.goForward':
        await this.page.goForward()
        break
      case 'Page.goBackward':
        await this.page.goBack()
        break
      case 'Page.removeSelection':
        await this.removeSelection(data.value.uid)
        break
      case 'Page.pasteFromClipboard':
        await this.pasteFromClipboard(data.value.uid, data.value.text)
        break
      case 'Page.selectAll':
        await this.selectAll(data.value.uid)
        break
      case 'extension.findSearchBarQuery':
        const matchesLength = await this.updateHighlights(data.value.text);
        try {
          this.emit('extension.findSearchBarQuery', {
            callbackId,
            result: matchesLength,
          } as any)
        } catch (e) {
          this.emit('extension.findSearchBarQuery', {
            callbackId,
            error: e.message,
          } as any)
        }
        break
      case 'extension.scrollToFindSearchBarQueryMatch':
        await this.scrollToHighlightedMatch(data.value.previousIndex, data.value.currentIndex);
        break
      case 'extension.closeFindSearchBar':
        await this.removeAllHighlights();
        break
      case 'Clipboard.writeText':
        await this.clipboard.writeText(data.value)
        break
      case 'Clipboard.readText':
        try {
          this.emit({
            callbackId,
            result: await this.clipboard.readText(),
          } as any)
        }
        catch (e) {
          this.emit({
            callbackId,
            error: e.message,
          } as any)
        }
        break
      default:
        this.client
          .send(action as any, data)
          .then((result: any) => {
            this.emit({
              callbackId,
              result,
            } as any)
          })
          .catch((err: any) => {
            this.emit({
              callbackId,
              error: err.message,
            } as any)
          })
    }
  }

  public async launch(): Promise<void> {
    await Promise.allSettled([
      // TODO setting for enable sync copy and paste
      this.page.exposeFunction(ExposedFunc.EnableCopyPaste, () => true),
      this.page.exposeFunction(ExposedFunc.EmitCopy, (text: string) => this.clipboard.writeText(text)),
      this.page.exposeFunction(ExposedFunc.GetPaste, () => this.clipboard.readText()),

      this.page.exposeFunction(ExposedFunc.EmitContextMenu, (data: any) => this.emit('extension.contextMenu', data)),
      this.page.exposeFunction(ExposedFunc.EmitSelection, (data: any) => this.emit('extension.selection', data)),
      this.page.exposeFunction(ExposedFunc.EmitClick, () => this.emit('extension.click')),
      this.page.exposeFunction(ExposedFunc.EmitSelectAll, async (id: string) => await this.selectAll(id)),

      this.page.exposeFunction(ExposedFunc.EmitFindSearchBarQuery, () => this.emit('extension.openFindSearchBar')),
      this.page.exposeFunction(ExposedFunc.RemoveAllHighlights, () => this.removeAllHighlights()),
      this.page.exposeFunction(ExposedFunc.UpdateHighlights, (text: string) => this.updateHighlights(text)),
    ])
    this.page.evaluateOnNewDocument(async () => {
      // custom embedded devtools
      localStorage.setItem('screencastEnabled', 'false')
      localStorage.setItem('panel-selectedTab', 'console')

      // sync copy and paste
      if (window[ExposedFunc.EnableCopyPaste]?.()) {
        const copyHandler = (event: ClipboardEvent) => {
          const text = event.clipboardData?.getData('text/plain') || document.getSelection()?.toString()
          text && window[ExposedFunc.EmitCopy]?.(text)
        }
        document.addEventListener('copy', copyHandler)
        document.addEventListener('cut', copyHandler)
        document.addEventListener('paste', async (event) => {
          event.preventDefault()
          const text = await window[ExposedFunc.GetPaste]?.()
          if (!text) {
            return
          }
          document.execCommand('insertText', false, text)
        })
        document.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault()
            window[ExposedFunc.EmitFindSearchBarQuery]?.()
            return;
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            window[ExposedFunc.EmitSelectAll]?.()
            return;
          }
        })
        document.addEventListener('contextmenu', function (event) {
          event.preventDefault()
          const element = event.target as HTMLElement
          
          const uid = 'dot-website-oncontextmenu'
          element.setAttribute('data-unique-id', uid);

          let isContentEditable = false;

          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
            const selectionStart = inputElement.selectionStart || 0;
            const selectionEnd = inputElement.selectionEnd || 0;
            
            element.setAttribute('data-selection-start', selectionStart.toString());
            element.setAttribute('data-selection-end', selectionEnd.toString());
            isContentEditable = true;
          } else if (element.isContentEditable) {
            const selection = window.getSelection();
            const serializedSelection = serializeSelection(selection);

            localStorage.setItem('serializedSelection', serializedSelection);
            isContentEditable = true;
          }

          window[ExposedFunc.EmitContextMenu]?.({
            x: event.clientX,
            y: event.clientY,
            selectedElementUid: uid,
            selectedElementText: document.getSelection()?.toString(),
            isSelectedElementEditable: isContentEditable,
          })
        });
        document.addEventListener('mouseup', (event) => {
          const selectedElementText = document.getSelection()?.toString()
          const element = event.target as HTMLElement
          const isSelectedElementEditable = element.isContentEditable
            || element.tagName === 'INPUT'
            || element.tagName === 'TEXTAREA'
          
          if (selectedElementText) {
            window[ExposedFunc.EmitSelection]?.({
              selectedElementText,
              isSelectedElementEditable,
            })
          }
        });
        document.addEventListener('click', () => {
          window[ExposedFunc.EmitClick]?.()
        });
      }
      
      function getXPathForElement(element) {
        const idx = (sib, name) => sib
          ? idx(sib.previousElementSibling, name || sib.localName) + (sib.localName === name)
          : 1;
        const segs = elm => !elm || elm.nodeType !== 1
          ? ['']
          : elm.id && document.getElementById(elm.id) === elm
            ? [`id("${elm.id}")`]
            : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm, elm.localName)}]`];
        return segs(element).join('/');
      }
      
      function serializeSelection(selection) {
        const ranges: any[] = [];
        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);
          ranges.push({
            startXPath: getXPathForElement(range.startContainer),
            startOffset: range.startOffset,
            endXPath: getXPathForElement(range.endContainer),
            endOffset: range.endOffset
          });
        }
        return JSON.stringify(ranges);
      }
    })
      
    this.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: isDarkTheme() ? 'dark' : 'light' }])
    
    this.client = await this.page.target().createCDPSession()
    
    // @ts-expect-error
    EventEmitterEnhancer.modifyInstance(this.client)
    
    // @ts-expect-error
    this.client.else((action: string, data: object) => {
      // console.log('◀ browserPage.received', action)
      this.emit({
        method: action,
        result: data,
      } as any)
    })
  }

  public async removeSelection(uid: string) {
    await this.page.evaluate((uid: string) => {
      const element = document.querySelector(`[data-unique-id=${uid}]`)
      if (!element) {
        return
      }
      element.removeAttribute('data-unique-id');
      if (element instanceof HTMLElement && element.isContentEditable) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          range.deleteContents();
        }
      } else {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        const dataSelectionStart = inputElement.getAttribute('data-selection-start');
        if (!dataSelectionStart) {
          console.error(`Page.pasteFromClipboard: inputElement.getAttribute('data-selection-start') ${inputElement.getAttribute('data-selection-start')}`)
          return;
        }
        const selectionStart = parseInt(dataSelectionStart || '0');

        const dataSelectionEnd = inputElement.getAttribute('data-selection-end');
        if (!dataSelectionEnd) {
          console.error(`Page.pasteFromClipboard: inputElement.getAttribute('data-selection-end') ${inputElement.getAttribute('data-selection-end')}`)
          return;
        }
        const selectionEnd = parseInt(dataSelectionEnd || '0');

        inputElement.value = inputElement.value.slice(0, selectionStart) + inputElement.value.slice(selectionEnd);
        inputElement.selectionStart = selectionStart;
        inputElement.selectionEnd = selectionStart;

        inputElement.removeAttribute('data-selection-start');
        inputElement.removeAttribute('data-selection-end');
      }
    }, uid)
  }

  public async pasteFromClipboard(uid: string, text: string) {
    await this.page.evaluate(async (uid: string, text: string) => {
      const element = document.querySelector(`[data-unique-id=${uid}]`)
      if (!element) {
        return
      }
      element.removeAttribute('data-unique-id');
          
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
            
        const dataSelectionStart = inputElement.getAttribute('data-selection-start');
        if (!dataSelectionStart) {
          console.error(`Page.pasteFromClipboard: inputElement.getAttribute('data-selection-start') ${inputElement.getAttribute('data-selection-start')}`)
          return;
        }
        const selectionStart = parseInt(dataSelectionStart || '0');

        const dataSelectionEnd = inputElement.getAttribute('data-selection-end');
        if (!dataSelectionEnd) {
          console.error(`Page.pasteFromClipboard: inputElement.getAttribute('data-selection-end') ${inputElement.getAttribute('data-selection-end')}`)
          return;
        }
        const selectionEnd = parseInt(dataSelectionEnd || '0');

        inputElement.value = inputElement.value.slice(0, selectionStart) + text + inputElement.value.slice(selectionEnd);
        inputElement.selectionStart = selectionStart + text.length;
        inputElement.selectionEnd = selectionStart + text.length;

        inputElement.removeAttribute('data-selection-start');
        inputElement.removeAttribute('data-selection-end');
        return;
      } else if (element instanceof HTMLElement && element.isContentEditable) {
        // TODO: Test this
        const serializedSelection = localStorage.getItem('serializedSelection');
        console.log('Page.pasteFromClipboard: serializedSelection', JSON.stringify(serializedSelection));
        const selection = deserializeSelection(serializedSelection);
        if (!selection) {
          return;
        }

        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
        if (!range) {
          return;
        }
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        range.setStart(textNode, text.length);
        range.setEnd(textNode, text.length);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      function getElementByXPath(xpath) {
        return document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      }

      function deserializeSelection(json) {
        const rangesData = JSON.parse(json);
        const selection = window.getSelection();
        if (!selection) {
          return;
        }
        selection.removeAllRanges();

        rangesData.forEach(data => {
          const range = document.createRange();
          const startNode = getElementByXPath(data.startXPath);
          const endNode = getElementByXPath(data.endXPath);
          if (!startNode || !endNode) {
            console.error(`deserializeSelection: startNode ${startNode} endNode ${endNode} data ${data}`);
            return;
          }
          range.setStart(startNode, data.startOffset);
          range.setEnd(endNode, data.endOffset);
          selection.addRange(range);
        });

        return selection;
      }
    }, uid, text)
  }
  
  public async selectAll(uid: string) {
    await this.page.evaluate((uid: string) => {
      let element = document.activeElement;
      if (uid) {
        element = document.querySelector(`[data-unique-id=${uid}]`)
        if (!element) {
          return
        }
        element.removeAttribute('data-unique-id');
      }

      // Check if the currently focused element is an input or textarea
      if (element
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')
      ) {
        // event.preventDefault();
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        inputElement.select();
        return;
      }

      // event.preventDefault()
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        // Get the current range (caret position or current selection)
        const range = selection.getRangeAt(0);

        // Find the parent element of the current range
        let currentElement: Node | null = range.commonAncestorContainer;
        if (currentElement.nodeType === Node.TEXT_NODE) {
          currentElement = currentElement.parentNode;
        }

        // // Traversing up the DOM tree to find the nearest contenteditable ancestor is default browser behaviour
        while (currentElement &&
          currentElement instanceof HTMLElement
          && !currentElement.isContentEditable
        ) {
          currentElement = currentElement.parentNode;
        }

        // Create a new range to select all content within the parent element
        const newRange = document.createRange();
        if (!currentElement || !(currentElement as HTMLElement).isContentEditable) {
          newRange.selectNodeContents(document.body);
        } else {
          newRange.selectNodeContents(currentElement);
        }

        // Clear the current selection and add the new range
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        console.error(`keydown: ctrl+a: window.getSelection() ${window.getSelection()}`)
        return;
      }
      return;
    }, uid)
  }
    
  public async removeAllHighlights() {
    await this.page.evaluate(() => {
      function isTextVisible(node: Node): boolean {
        // Your logic to determine if the text is visible
        return true; // Placeholder, replace with your actual logic
      }
      
      const removeHighlights = (node: Node) => {
        if (!node.textContent || !node.parentNode || !isTextVisible(node)) {
          return;
        }
        
        if (node instanceof Element
          && (node.classList.contains('highlight-find-search-bar-query')
          || node.classList.contains('selected-highlight-find-search-bar-query'))
        ) {
          node.parentNode.replaceChild(document.createTextNode(node.textContent), node);
          return;
        }
        
        node.childNodes.forEach(child => removeHighlights(child));
      }
      
      removeHighlights(document.body);
    });
  }
  
  public async updateHighlights(text: string): Promise<number> {
    const keyword = text.trim();
    
    const highlightStyle = `
    .highlight-find-search-bar-query {
      background-color: yellow;
      color: black;
    }`;
    const selectedHighlightStyle = `
    .selected-highlight-find-search-bar-query {
      background-color: orange;
      color: black;
    }`;
    await this.page.addStyleTag({ content: highlightStyle });
    await this.page.addStyleTag({ content: selectedHighlightStyle });
      
    const matchesLength = await this.page.evaluate(async (keyword: string) => {
      const matches: HTMLElement[] = [];
      let id = 0;
      
      const removeHighlights = (node: Node) => {
        if (!node.textContent || !node.parentNode || !isVisible(node)) {
          return;
        }
        
        if (node instanceof Element
          && (node.classList.contains('highlight-find-search-bar-query')
          || node.classList.contains('selected-highlight-find-search-bar-query'))
        ) {
          node.parentNode.replaceChild(document.createTextNode(node.textContent), node);
          return;
        }
        
        node.childNodes.forEach(child => removeHighlights(child));
      }
      
      const isVisible = (node: Node) => {
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
        if (!el) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        const isMetadataTag = (element) => {
          const metadataTags = ['META', 'TITLE', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK'];
          return metadataTags.includes(element.tagName);
        };
        
        return (
          rect.width > 0
          && rect.height > 0
          && style.visibility !== 'hidden'
          && style.display !== 'none'
          && !isMetadataTag(el)
        );
      };
      
      const highlightTexts = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent || !node.parentNode || !isVisible(node)) {
            return;
          }
          
          let textContent = node.textContent;
          let nextNode = node.nextSibling;
          
          while (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
            textContent += nextNode.textContent;
            nextNode = nextNode.nextSibling;
          }
          
          const matchIndex = textContent.toLowerCase().indexOf(keyword.toLowerCase());
          if (matchIndex === -1) {
            return;
          }
          const matchLength = keyword.length;
          
          const beforeText = textContent.substring(0, matchIndex);
          const highlightText = textContent.substring(matchIndex, matchIndex + matchLength);
          const afterText = textContent.substring(matchIndex + matchLength);
          
          const parentNode = node.parentNode;
          
          // Create a document fragment to hold the new nodes
          const fragment = document.createDocumentFragment();
          
          // Create and append the new nodes to the fragment
          if (beforeText) {
            fragment.appendChild(document.createTextNode(beforeText));
          }
          
          const highlightedSpan = document.createElement('span');
          highlightedSpan.className = 'highlight-find-search-bar-query';
          highlightedSpan.id = `highlight-find-search-bar-query-match-${id++}`;
          highlightedSpan.textContent = highlightText;
          fragment.appendChild(highlightedSpan);
          matches.push(highlightedSpan);

          if (afterText) {
            fragment.appendChild(document.createTextNode(afterText));
          }

          // Replace the original text node with the fragment
          let currentNode: Node | null = node;
          while (currentNode && currentNode !== nextNode) {
            const next = currentNode.nextSibling;
            parentNode.removeChild(currentNode);
            currentNode = next;
          }

          parentNode.insertBefore(fragment, nextNode);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          Array.from(node.childNodes).forEach(highlightTexts);
        }
      }

      removeHighlights(document.body);
      highlightTexts(document.body);

      return matches.length;
    }, keyword);

    return matchesLength;
  }

  public async scrollToHighlightedMatch(previousIndex: number, currentIndex: number) {
    await this.page.evaluate((prevIndex, curIndex) => {
      const element = document.getElementById(`highlight-find-search-bar-query-match-${curIndex}`);
      if (element) {
        element.classList.add('selected-highlight-find-search-bar-query');
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      const elementPrev = document.getElementById(`highlight-find-search-bar-query-match-${prevIndex}`);
      if (elementPrev) {
        elementPrev.classList.remove('selected-highlight-find-search-bar-query');
      }
    }, previousIndex, currentIndex);
  }
}
