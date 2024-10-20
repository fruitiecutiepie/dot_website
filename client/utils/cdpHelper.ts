export class CDPHelper {
  private connection: any

  constructor(connection: any) {
    this.connection = connection
  }

  public async resolveElementProperties(objectId: any, maxDepth: number) {
    const initialProperties = await this.getProperties(objectId)

    const resolve = async (props: any, passedDepth: number) => {
      const resolveResult = {}
      const internalCurentDepth = passedDepth | 0

      for (const item of props) {
        let value = null
        if (item.value) {
          if (item.value.type === 'object') {
            if (item.value.objectId) {
              if (internalCurentDepth < maxDepth) {
                value = await this.getProperties(item.value.objectId)
                if (Array.isArray(value)) {
                  const newDepth = internalCurentDepth + 1
                  value = await resolve(value, newDepth)
                }
              }
              else {
                value = '<max depth reached>'
              }
            }
            else if (item.value.value) {
              value = item.value.value
            }
          }
          else if (item.value.type === 'function') {
            value = 'function'
          }
          else if (item.value.type === 'string') {
            value = item.value.value
          }
          else if (item.value.type === 'number') {
            value = item.value.value
          }
        }

        Object.defineProperty(resolveResult, item.name, {
          value,
          enumerable: item.enumerable,
          configurable: item.configurable,
          writable: item.writable,
        })
      }
      return resolveResult
    }

    const result = await resolve(initialProperties, 0)

    return result
  }

  public async getProperties(objectId: string) {
    const data: any = await this.connection.send('Runtime.getProperties', {
      objectId,
      ownProperties: true,
    })

    return data.result as Array<object>
  }

  public async getCursorForNode(nodeInfo: any) {
    let nodeId = nodeInfo.nodeId
    if (!nodeInfo.nodeId)
      nodeId = await this.getNodeIdFromBackendId(nodeInfo.backendNodeId)

    if (!nodeId) return;

    const computedStyleReq = await this.connection.send('CSS.getComputedStyleForNode', {
      nodeId,
    })
    if (!computedStyleReq.computedStyle) return;

    const cursorCSS = computedStyleReq.computedStyle.find((c: any) => c.name === 'cursor')
    return cursorCSS.value;
  }

  public async getNodeIdFromBackendId(backendNodeId: any) {
    await this.connection.send('DOM.getDocument')
    const nodeIdsReq = await this.connection.send('DOM.pushNodesByBackendIdsToFrontend', {
      backendNodeIds: [backendNodeId],
    })

    if (!nodeIdsReq) {
      return undefined;
    }
    return nodeIdsReq.nodeIds[0]
  }
}
