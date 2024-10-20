export interface IViewportContextMenu {
  menuItems: Array<IViewportContextMenuItemProps>
  isVisible: boolean
  position: IPosition
  selectedElementUid: string
  selectedElementText: string
  isSelectedElementEditable: boolean
  href: string
}

export interface IViewportContextMenuProps extends IViewportContextMenu {
  setVisibility: (value: boolean) => void
  onActionInvoked: (action: string, data?: object) => Promise<any>
  selectedElementText: string
  href: string

}

export interface IViewportContextMenuItemState {
  itemType: ViewportContextMenuItemsType
  isDisabled?: boolean
}

export interface IViewportContextMenuItemProps extends IViewportContextMenuItemState {
  handleClick: (event: React.MouseEvent<HTMLLIElement>) => void
  setVisibility: (value: boolean) => void
}

export enum ViewportContextMenuItemsType {
  Cut = 'Cut',
  Copy = 'Copy',
  Paste = 'Paste',
  SelectAll = 'Select All',
  CopyLink = 'Copy Link',
  CopyLinkDomain = 'Copy Domain URL',
  Separator = '-',
}

export interface IPosition {
  x: number
  y: number
}
