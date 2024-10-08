import React from 'react'
import type {
  IViewportContextMenu,
  IViewportContextMenuProps,
} from './viewport-contextmenu-models'
import {
  ViewportContextMenuItemsType,
} from './viewport-contextmenu-models'
import ViewportContextMenuItem from './viewportcontextmenuitem'

class ViewportContextMenu extends React.Component<IViewportContextMenuProps, IViewportContextMenu> {
  private ref?: HTMLUListElement
  constructor(props: IViewportContextMenuProps) {
    super(props)
    this.state = {
      isVisible: false,
      position: {
        x: 0,
        y: 0,
      },
      selectedElementUid: '',
      selectedElementText: this.props.selectedElementText,
      isSelectedElementEditable: false,
      href: this.props.href,
      
      // assign menuItems
      menuItems: [
        {
          itemType: ViewportContextMenuItemsType.Cut,
          setVisibility: this.props.setVisibility,
          handleClick: e => this.CutHandler(e),
        },
        {
          itemType: ViewportContextMenuItemsType.Copy,
          setVisibility: this.props.setVisibility,
          handleClick: e => this.CopyHandler(e),
        },
        {
          itemType: ViewportContextMenuItemsType.Paste,
          setVisibility: this.props.setVisibility,
          handleClick: e => this.PasteHandler(e),
        },
        {
          itemType: ViewportContextMenuItemsType.Separator,
          setVisibility: this.props.setVisibility,
          handleClick: () => {},
        },
        {
          itemType: ViewportContextMenuItemsType.SelectAll,
          setVisibility: this.props.setVisibility,
          handleClick: e => this.SelectAllHandler(e),
        },
        {
          itemType: ViewportContextMenuItemsType.CopyLink, // Added Copy Link option
          setVisibility: this.props.setVisibility,
          handleClick: e => this.CopyLinkHandler(e),
        },
        {
          itemType: ViewportContextMenuItemsType.CopyLinkDomain, // Added Copy Link Domain option
          setVisibility: this.props.setVisibility,
          handleClick: e => this.CopyLinkDomainHandler(e),
        },
      ],
    }

    this.setRef = this.setRef.bind(this)
    this.handleClickOutside = this.handleClickOutside.bind(this)
  }
  
  // async componentDidUpdate(prevProps: IViewportContextMenuProps, prevState: IViewportContextMenu) {
  //   if (this.state.selectedElementText !== prevProps.selectedElementText
  //     || this.state.isVisible !== prevProps.isVisible
  //   ) {
  //     console.log('viewportContextMenu.componentDidUpdate')
  //     await this.manageMenuItemsStatus();
  //   }
  // }
    
  // static getDerivedStateFromProps(nextProps: IViewportContextMenuProps, prevState: IViewportContextMenu) {
  //   const updates: Partial<IViewportContextMenu> = {};
    
  //   if (
  //     nextProps.position.x !== prevState.position.x ||
  //     nextProps.position.y !== prevState.position.y
  //   ) {
  //     updates.position = nextProps.position;
  //   }
  //   if (nextProps.selectedElementText !== prevState.selectedElementText) {
  //     console.log('viewportContextMenu.getDerivedStateFromProps selectedElementText')
  //     updates.selectedElementText = nextProps.selectedElementText;
  //   }
  //   if (nextProps.isVisible !== prevState.isVisible) {
  //     console.log('viewportContextMenu.getDerivedStateFromProps')
  //     updates.isVisible = nextProps.isVisible;
  //   }

  //   return Object.keys(updates).length ? updates : null;
  // }

  UNSAFE_componentWillReceiveProps(nextProps: IViewportContextMenuProps) {
    if (
      nextProps.position.x !== this.state.position.x
      || nextProps.position.y !== this.state.position.y
    ) {
      this.setState({
        position: nextProps.position,
      })
    }
    if (nextProps.selectedElementText !== this.state.selectedElementText) {
      this.setState({
        selectedElementText: this.state.selectedElementText,    //** 
      })
      this.manageMenuItemsStatus()
    }

    if (nextProps.href !== this.state.href) {
      this.setState({
        href: this.state.href, 
      })
      this.manageMenuItemsStatus()
    }

    if (nextProps.isVisible !== this.state.isVisible) {
      this.setState({
        isVisible: nextProps.isVisible,
      })
      this.manageMenuItemsStatus()
    }
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  async manageMenuItemsStatus() {
    const _menuItems = [...this.state.menuItems]

    // Cut
    const cut = this.state.menuItems.find(
      x => x.itemType === ViewportContextMenuItemsType.Cut,
    )
    const cutIndex = this.state.menuItems.findIndex(
      x => x.itemType === ViewportContextMenuItemsType.Cut,
    )

    // Copy
    const copy = this.state.menuItems.find(
      x => x.itemType === ViewportContextMenuItemsType.Copy,
    )
    const copyIndex = this.state.menuItems.findIndex(
      x => x.itemType === ViewportContextMenuItemsType.Copy,
    )

    const length = this.state.selectedElementText?.length
    if (length && length > 0) {
      if (cut) {
        if (this.state.isSelectedElementEditable) {
          _menuItems[cutIndex].isDisabled = false
          this.setState({ menuItems: _menuItems })
        } else {
          _menuItems[cutIndex].isDisabled = true
          this.setState({ menuItems: _menuItems })
        }
      }
      if (copy) {
        _menuItems[copyIndex].isDisabled = false
        this.setState({ menuItems: _menuItems })
      }
    } else {
      if (cut) {
        _menuItems[cutIndex].isDisabled = true
        this.setState({ menuItems: _menuItems })
      }
      if (copy) {
        _menuItems[copyIndex].isDisabled = true
        this.setState({ menuItems: _menuItems })
      }
    }

    // Paste
    const paste = this.state.menuItems.find(
      x => x.itemType === ViewportContextMenuItemsType.Paste,
    )
    const pasteIndex = this.state.menuItems.findIndex(
      x => x.itemType === ViewportContextMenuItemsType.Paste,
    )

    if (
      this.props.onActionInvoked
      && (await this.props.onActionInvoked('readClipboard'))
    ) {
      if (paste) {
        _menuItems[pasteIndex].isDisabled = false
        this.setState({ menuItems: _menuItems })
      }
    }
    else {
      if (paste) {
        _menuItems[pasteIndex].isDisabled = true
        this.setState({ menuItems: _menuItems })
      }
    }

    // Enable/disable Copy Link and Copy Link (Domain)
    const copyLink = this.state.menuItems.find(
      x => x.itemType === ViewportContextMenuItemsType.CopyLink,
    )
    const copyLinkIndex = this.state.menuItems.findIndex(
      x => x.itemType === ViewportContextMenuItemsType.CopyLink,
    )

    const copyDomain = this.state.menuItems.find(
      x => x.itemType === ViewportContextMenuItemsType.CopyLinkDomain,
    )
    const copyDomainIndex = this.state.menuItems.findIndex(
      x => x.itemType === ViewportContextMenuItemsType.CopyLinkDomain,
    )
    
    const linkLength = this.state.href?.length;
    if (copyLinkIndex === -1 || copyDomainIndex === -1) {  
      return;  
    }  
    
    // Enable/disable Copy Link option
    if (!linkLength) {
      _menuItems[copyLinkIndex].isDisabled = true;
    } else {
      _menuItems[copyLinkIndex].isDisabled = false;
    }

    // Enable/disable Copy Link Domain option
    if (!linkLength) {
      _menuItems[copyDomainIndex].isDisabled = true;
    } else {
      _menuItems[copyDomainIndex].isDisabled = false;
    }

    this.setState({ menuItems: _menuItems });
      
  }

  public render() {
    const className = ['viewportContextMenu']
    if (!this.state.isVisible)
      className.push('hidden')

    const menuStyle = {
      left: this.state.position.x,
      top: this.state.position.y,
    }

    return (
      <ul className={className.join(' ')} style={menuStyle} ref={this.setRef}>
        {this.state.menuItems.map((item, index) => {
          return <ViewportContextMenuItem {...item} key={index} />
        })}
      </ul>
    )
  }

  private setRef(node: HTMLUListElement) {
    this.ref = node
  }

  public handleClickOutside(e: MouseEvent) {
    // console.log("REF: ", this.ref)
    // console.log("Target: ", e.target)
    if (this.ref && !this.ref.contains(e.target as Node)){
      // console.log("Entered the second if!!")
        this.props.setVisibility(false)
    } 
  }

  private async CutHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked && this.state.selectedElementText) {
      await this.props.onActionInvoked('writeClipboard', {
        value: this.state.selectedElementText,
      })
      await this.props.onActionInvoked('removeSelection', {
        value: {
          uid: this.state.selectedElementUid,
        },
      })
      this.setState({
        isVisible: false,
      })
    }
  }

  private async CopyHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked && this.state.selectedElementText) {
      await this.props.onActionInvoked('writeClipboard', {
        value: this.state.selectedElementText,
      })
      this.setState({
        isVisible: false,
      })
    }
  }

  private async PasteHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked) {
      const value: string = await this.props.onActionInvoked('readClipboard')
      await this.props.onActionInvoked('pasteSelection', {
        value: {
          uid: this.state.selectedElementUid,
          text: value,
        },
      })
      this.setState({
        isVisible: false,
      })
    }
  }

  private async SelectAllHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked) {
      await this.props.onActionInvoked('selectAll', {
        value: {
          uid: this.state.selectedElementUid,
        },
      })
      this.setState({
        isVisible: false,
      })
    }
  }

  private async CopyLinkHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked && this.state.href) {
      await this.props.onActionInvoked('writeClipboard', {
        value: this.state.href,
      })
      this.setState({
        isVisible: false,
      })
    }
  }

  private async CopyLinkDomainHandler(event: React.MouseEvent<HTMLLIElement>) {
    if (this.props.onActionInvoked && this.state.href) {
      const fullUrl = this.state.href;
      let link = '';
      try{
        const url = new URL(fullUrl);
    
        // Extract the main domain
        const mainDomain = `${url.protocol}//${url.hostname}`;

        //Include the port number if present
        link = url.port ? `${mainDomain}:${url.port}` : mainDomain;
        
      }catch(error){
        console.error('Invalid URL:', error);
      }

      await this.props.onActionInvoked('writeClipboard', {
        value: link,
      })
      this.setState({
        isVisible: false,
      })
    }
  }
}

export default ViewportContextMenu
