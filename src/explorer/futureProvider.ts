import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import globalState from '../globalState';
import { LeekTreeItem } from '../shared/leekTreeItem';
import { defaultFundInfo, SortType, FutureCategory } from '../shared/typed';
import { LeekFundConfig } from '../shared/leekConfig';
import futureService from './futureService';

export class FutureProvider implements TreeDataProvider<LeekTreeItem> {
  private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();

  readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

  private service: futureService;
  private order: SortType;

  constructor(service: futureService) {
    this.service = service;
    this.order = LeekFundConfig.getConfig('leek-fund.futureSort') || SortType.NORMAL;
  }

  refresh(): any {
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element?: LeekTreeItem | undefined): LeekTreeItem[] | Thenable<LeekTreeItem[]> {
    if (!element) {
      // Root view
      const futureCodes = LeekFundConfig.getConfig('leek-fund.futures') || [];
      return this.service.getData(futureCodes, this.order).then(() => {
        return this.getRootNodes();
      });
    } else {
      const resultPromise = Promise.resolve(this.service.futureList || []);
      switch (
        element.id // First-level
      ) {
        case FutureCategory.F:
          return this.getFFutureNodes(resultPromise);
        case FutureCategory.NODATA:
          return this.getNoDataFutureNodes(resultPromise);
        default:
          return [];
        // return this.getChildrenNodesById(element.id);
      }
    }
  }

  getParent(element: LeekTreeItem): LeekTreeItem | undefined {
    return undefined;
  }

  getTreeItem(element: LeekTreeItem): TreeItem {
    if (!element.isCategory) {
      return element;
    } else {
      return {
        id: element.id,
        label: element.info.name,
        // tooltip: this.getSubCategoryTooltip(element),
        collapsibleState:
          element.id === FutureCategory.F
            ? TreeItemCollapsibleState.Expanded
            : TreeItemCollapsibleState.Collapsed,
        // iconPath: this.parseIconPathFromProblemState(element),
        command: undefined,
        contextValue: element.contextValue,
      };
    }
  }

  getRootNodes(): LeekTreeItem[] {
    const nodes = [
      new LeekTreeItem(
        Object.assign({ contextValue: 'category' }, defaultFundInfo, {
          id: FutureCategory.F,
          name: `${FutureCategory.F}${
            globalState.futureCount > 0 ? `(${globalState.futureCount})` : ''
          }`,
        }),
        undefined,
        true
      ),
    ];
    // 显示接口不支持的期货，避免用户老问为什么添加了期货没反应
    if (globalState.noDataFutureCount) {
      nodes.push(
        new LeekTreeItem(
          Object.assign({ contextValue: 'category' }, defaultFundInfo, {
            id: FutureCategory.NODATA,
            name: `${FutureCategory.NODATA}(${globalState.noDataFutureCount})`,
          }),
          undefined,
          true
        )
      );
    }
    return nodes;
  }

  getFFutureNodes(futures: Promise<LeekTreeItem[]>): Promise<LeekTreeItem[]> {
    const aFutures: Promise<LeekTreeItem[]> = futures.then((res: LeekTreeItem[]) => {
      const arr = res.filter((item: LeekTreeItem) => /^[a-zA-Z]+\d{4}$/.test(item.info.code || ''));
      return arr;
    });

    return aFutures;
  }

  getNoDataFutureNodes(futures: Promise<LeekTreeItem[]>): Promise<LeekTreeItem[]> {
    return futures.then((res: LeekTreeItem[]) => {
      return res.filter((item: LeekTreeItem) => {
        return /^(nodata)/.test(item.type || '');
      });
    });
  }

  changeOrder(): void {
    let order = this.order as number;
    order += 1;
    if (order > 1) {
      this.order = SortType.DESC;
    } else if (order === 1) {
      this.order = SortType.ASC;
    } else if (order === 0) {
      this.order = SortType.NORMAL;
    }
    LeekFundConfig.setConfig('leek-fund.futureSort', this.order);
    this.refresh();
  }
}
