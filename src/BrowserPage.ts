import EventEmitterEnhancer, { EnhancedEventEmitter } from 'event-emitter-enhancer'
import { Browser, CDPSession, Page } from 'puppeteer'
import { Clipboard } from './Clipboard'
import { isDarkTheme } from './Config'
import { res, res_async } from './res'

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
        const [forwardOk, forwardErr] = await res_async(() => this.page.goForward())
        if (forwardErr) {
          console.error('Page.goForward', forwardErr)
          return
        }
        break
      case 'Page.goBackward':
        const [backwardOk, backwardErr] = await res_async(() => this.page.goBack())
        if (backwardErr) {
          console.error('Page.goBackward', backwardErr)
          return
        }
        break
      case 'Page.removeSelection':
        const [removeOk, removeErr] = await res_async(() => this.removeSelection(data.value.uid))
        if (removeErr) {
          console.error('Page.removeSelection', removeErr)
          return
        }
        break
      case 'Page.pasteFromClipboard':
        const [pasteOk, pasteErr] = await res_async(() => this.pasteFromClipboard(data.value.uid, data.value.text))
        if (pasteErr) {
          console.error('Page.pasteFromClipboard', pasteErr)
          return
        }
        break
      case 'Page.selectAll':
        const [selectOk, selectErr] = await res_async(() => this.selectAll(data.value.uid))
        if (selectErr) {
          console.error('Page.selectAll', selectErr)
          return
        }
        break
      case 'extension.findSearchBarQuery':
        const [matchesLength, matchesLengthErr] = await res_async(() => this.updateHighlights(data.value.text));
        if (matchesLengthErr) {
          console.error('extension.findSearchBarQuery', matchesLengthErr)
          return
        }
        const [findSearchBarQueryOk, findSearchBarQueryErr] = res(() => this.emit('extension.findSearchBarQuery', {
          callbackId,
          result: matchesLength,
        } as any))
        if (findSearchBarQueryErr) {
          console.error('extension.findSearchBarQuery', findSearchBarQueryErr)
          this.emit('extension.findSearchBarQuery', {
            callbackId,
            error: findSearchBarQueryErr.message,
          } as any)
          return
        }
        break
      case 'extension.scrollToFindSearchBarQueryMatch':
        const [scrollToOk, scrollToErr] = await res_async(() => this.scrollToHighlightedMatch(data.value.previousIndex, data.value.currentIndex));
        if (scrollToErr) {
          console.error('extension.scrollToFindSearchBarQueryMatch', scrollToErr)
          return
        }
        break
      case 'extension.closeFindSearchBar':
        const [closeFindSearchBarOk, closeFindSearchBarErr] = await res_async(() => this.removeAllHighlights());
        if (closeFindSearchBarErr) {
          console.error('extension.closeFindSearchBar', closeFindSearchBarErr)
          return
        }
        break
      case 'Clipboard.writeText':
        const [writeTextOk, writeTextErr] = await res_async(() => this.clipboard.writeText(data.value))
        if (writeTextErr) {
          console.error('Clipboard.writeText', writeTextErr)
          return
        }
        break
      case 'Clipboard.readText':
        const [readText, readTextErr] = await res_async(() => this.clipboard.readText())
        if (readTextErr) {
          console.error('Clipboard.readText', readTextErr)
          return
        }
        const [readTextOk, readTextResultErr] = res(() => this.emit({
          callbackId,
          result: readText,
        } as any))
        if (readTextResultErr) {
          console.error('Clipboard.readText', readTextResultErr)
          this.emit({
            callbackId,
            error: readTextResultErr.message,
          } as any)
          return
        }
        break
      case 'DOM.getNodeForLocation':
        const [getNodeForLocationOk, getNodeForLocationErr] = await res_async(() => 
          this.client.send('DOM.getNodeForLocation', data as any)
        );
        if (getNodeForLocationErr) {
          // console.error('BrowserPage.getNodeForLocation', getNodeForLocationErr)
          return
        }
        const [sendNodeOk, sendNodeErr] = res(() => this.emit({
          callbackId,
          result: getNodeForLocationOk,
        } as any))
        if (sendNodeErr) {
          console.error('BrowserPage.sendNodeErr', sendNodeErr)
          this.emit({
            callbackId,
            error: sendNodeErr.message,
          } as any)
          return
        }
        break
      default:
        if (action.startsWith('extension')) return;
        
        const [sendResOk, sendResErr] = await res_async(() => this.client.send(action as any, data))
        if (sendResErr) {
          return;
        }
        const [sendOk, sendErr] = res(() => this.emit({
          callbackId,
          result: sendResOk,
        } as any))
        if (sendErr) {
          console.error('BrowserPage.sendErr', sendErr)
          this.emit({
            callbackId,
            error: sendErr.message,
          } as any)
          return
        }
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
    // console.log("Entered here2");
    this.page.evaluateOnNewDocument(async () => {
      // console.log("Is it entered?");
      // custom embedded devtools
      localStorage.setItem('screencastEnabled', 'false')
      localStorage.setItem('panel-selectedTab', 'console')

      // sync copy and paste
      if (window[ExposedFunc.EnableCopyPaste]?.()) {
        // console.log("Entered here??");
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
        });
        document.addEventListener('contextmenu', function (event) {
          console.log("Entered this too");
          event.preventDefault()
          const element = event.target as HTMLElement
          
          const uid = 'dot-website-oncontextmenu'
          element.setAttribute('data-unique-id', uid);

          let isContentEditable = false;
          let linkUrl = ''; 
          const target = event.target as HTMLElement;
    
          if (target instanceof HTMLAnchorElement) {
            linkUrl = target.href;
          } else if (target.closest('a') && (target.closest('a') as HTMLAnchorElement).href) {
            // Cast the closest anchor element to HTMLAnchorElement
            linkUrl = (target.closest('a') as HTMLAnchorElement).href;
          }
          // console.log("Link is ", linkUrl);
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
            href: linkUrl,
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
