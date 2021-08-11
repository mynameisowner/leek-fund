import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import FundService from '../explorer/fundService';
import StockService from '../explorer/stockService';
import FutureService from '../explorer/futureService';
import globalState from '../globalState';
import { DEFAULT_LABEL_FORMAT } from '../shared/constant';
import { LeekFundConfig } from '../shared/leekConfig';
import { LeekTreeItem } from '../shared/leekTreeItem';
import { events, formatLabelString } from '../shared/utils';

export class StatusBar {
  private stockService: StockService;
  private futureService: FutureService;
  private fundService: FundService;
  private fundBarItem: StatusBarItem;
  private statusBarList: StatusBarItem[] = [];
  private statusBarFutureList: StatusBarItem[] = [];
  private statusBarItemLabelFormat: string = '';
  constructor(stockService: StockService, fundService: FundService, futureService: FutureService) {
    this.stockService = stockService;
    this.fundService = fundService;
    this.futureService = futureService
    this.statusBarList = [];
    this.statusBarFutureList = [];
    this.fundBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 3);
    this.refreshStockStatusBar();
    this.refreshFutureStatusBar();
    this.bindEvents();
    /* events.on('updateConfig:leek-fund.statusBarStock',()=>{
      
    }) */
  }

  get riseColor(): string {
    return LeekFundConfig.getConfig('leek-fund.riseColor');
  }

  get fallColor(): string {
    return LeekFundConfig.getConfig('leek-fund.fallColor');
  }

  /** 隐藏股市状态栏 */
  get hideStatusBarStock(): boolean {
    return LeekFundConfig.getConfig('leek-fund.hideStatusBarStock');
  }
  /** 隐藏状态栏 */
  get hideStatusBar(): boolean {
    return LeekFundConfig.getConfig('leek-fund.hideStatusBar');
  }
  /** 隐藏基金状态栏 */
  get hideFundBarItem(): boolean {
    return LeekFundConfig.getConfig('leek-fund.hideFundBarItem');
  }
    /** 隐藏期货状态栏 */
    get hideStatusBarFuture(): boolean {
      return LeekFundConfig.getConfig('leek-fund.hideStatusBarFuture');
    }

  bindEvents() {
    events.on('stockListUpdate', () => {
      this.refreshStockStatusBar();
    });
    events.on('fundListUpdate', () => {
      this.refreshFundStatusBar();
    });
    events.on('futureListUpdate', () => {
      this.refreshFutureStatusBar();
    });
  }

  refresh() {
    this.refreshFundStatusBar();
    this.refreshStockStatusBar();
    this.refreshFutureStatusBar();
  }

  refreshStockStatusBar() {
    if (this.hideStatusBar||this.hideStatusBarStock || !this.stockService.stockList.length) {
      if(this.statusBarList.length){
        this.statusBarList.forEach((bar) =>bar.dispose());
        this.statusBarList=[];
      }
      return;
    }

    let sz: LeekTreeItem | null = null;
    const statusBarStocks = LeekFundConfig.getConfig('leek-fund.statusBarStock');
    const barStockList: Array<LeekTreeItem> = new Array(statusBarStocks.length);

    this.statusBarItemLabelFormat =
      globalState.labelFormat?.['statusBarLabelFormat'] ??
      DEFAULT_LABEL_FORMAT.statusBarLabelFormat;

    this.stockService.stockList.forEach((stockItem) => {
      const { code } = stockItem.info;
      if (code === 'sh000001') {
        sz = stockItem;
      }
      if (statusBarStocks.includes(code)) {
        // barStockList.push(stockItem);
        barStockList[statusBarStocks.indexOf(code)] = stockItem;
      }
    });

    if (!barStockList.length) {
      barStockList.push(sz || this.stockService.stockList[0]);
    }

    let count = barStockList.length - this.statusBarList.length;
    if (count > 0) {
      while (--count >= 0) {
        const stockBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 3);
        this.statusBarList.push(stockBarItem);
      }
    } else if (count < 0) {
      let num = Math.abs(count);
      while (--num >= 0) {
        const bar = this.statusBarList.pop();
        bar?.hide();
        bar?.dispose();
      }
    }
    barStockList.forEach((stock, index) => {
      this.udpateBarInfo(this.statusBarList[index], stock);
    });
  }

  udpateBarInfo(stockBarItem: StatusBarItem, item: LeekTreeItem | null) {
    if (!item) return;

    const { type, symbol, price, percent, open, yestclose, high, low, updown } = item.info;
    const deLow = percent.indexOf('-') === -1;
    /* stockBarItem.text = `「${this.stockService.showLabel ? item.info.name : item.id}」${price}  ${
      deLow ? '📈' : '📉'
    }（${percent}%）`; */
    stockBarItem.text = formatLabelString(this.statusBarItemLabelFormat, {
      ...item.info,
      percent: `${percent}%`,
      icon: deLow ? '📈' : '📉',
    });

    stockBarItem.tooltip = `「今日行情」${type}${symbol}\n涨跌：${updown}   百分：${percent}%\n最高：${high}   最低：${low}\n今开：${open}   昨收：${yestclose}`;
    stockBarItem.color = deLow ? this.riseColor : this.fallColor;
    stockBarItem.command = {
      title: 'Change stock',
      command: 'leek-fund.changeStatusBarItem',
      arguments: [item.id],
    };

    stockBarItem.show();
    return stockBarItem;
  }

  refreshFutureStatusBar() {
    if (this.hideStatusBar||this.hideStatusBarFuture || !this.stockService.stockList.length) {
      if(this.statusBarFutureList.length){
        this.statusBarFutureList.forEach((bar) =>bar.dispose());
        this.statusBarFutureList=[];
      }
      return;
    }

    let sz: LeekTreeItem | null = null;
    const statusBarFutures = LeekFundConfig.getConfig('leek-fund.statusBarFuture');
    const barFutureList: Array<LeekTreeItem> = new Array(statusBarFutures.length);

    this.statusBarItemLabelFormat =
      globalState.labelFormat?.['statusBarLabelFormat'] ??
      DEFAULT_LABEL_FORMAT.statusBarLabelFormat;

    this.futureService.futureList.forEach((futureItem) => {
      const { code } = futureItem.info;
      if (code === 'sh000001') {
        sz = futureItem;
      }
      if (statusBarFutures.includes(code)) {
        // barStockList.push(stockItem);
        barFutureList[statusBarFutures.indexOf(code)] = futureItem;
      }
    });

    if (!barFutureList.length) {
      barFutureList.push(sz || this.stockService.stockList[0]);
    }

    let count = barFutureList.length - this.statusBarFutureList.length;
    if (count > 0) {
      while (--count >= 0) {
        const stockBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 3);
        this.statusBarFutureList.push(stockBarItem);
      }
    } else if (count < 0) {
      let num = Math.abs(count);
      while (--num >= 0) {
        const bar = this.statusBarFutureList.pop();
        bar?.hide();
        bar?.dispose();
      }
    }
    barFutureList.forEach((future, index) => {
      this.udpateFutureBarInfo(this.statusBarFutureList[index], future);
    });
  }

  udpateFutureBarInfo(futureBarItem: StatusBarItem, item: LeekTreeItem | null) {
    if (!item) return;

    const { type, symbol, price, percent, open, yestclose, high, low, updown } = item.info;
    const deLow = percent.indexOf('-') === -1;
    /* futureBarItem.text = `「${this.futureService.showLabel ? item.info.name : item.id}」${price}  ${
      deLow ? '📈' : '📉'
    }（${percent}%）`; */
    futureBarItem.text = formatLabelString(this.statusBarItemLabelFormat, {
      ...item.info,
      percent: `${percent}%`,
      icon: deLow ? '📈' : '📉',
    });

    futureBarItem.tooltip = `「今日行情」${type}${symbol}\n涨跌：${updown}   百分：${percent}%\n最高：${high}   最低：${low}\n今开：${open}   昨收：${yestclose}`;
    futureBarItem.color = deLow ? this.riseColor : this.fallColor;
    futureBarItem.command = {
      title: 'Change future',
      command: 'leek-fund.changeFutureStatusBarItem',
      arguments: [item.id],
    };

    futureBarItem.show();
    return futureBarItem;
  }

  refreshFundStatusBar() {
    // 隐藏基金状态栏
    if (this.hideStatusBar||this.hideFundBarItem) {
      this.fundBarItem.hide();
      return ;
    }

    this.fundBarItem.text = `🐥$(pulse)`;
    this.fundBarItem.color = this.riseColor;
    this.fundBarItem.tooltip = this.getFundTooltipText();
    this.fundBarItem.show();
    return this.fundBarItem;
  }

  private getFundTooltipText() {
    let fundTemplate = '';
    for (let fund of this.fundService.fundList.slice(0, 14)) {
      fundTemplate += `${
        fund.info.percent.indexOf('-') === 0 ? ' ↓ ' : fund.info.percent === '0.00' ? '' : ' ↑ '
      } ${fund.info.percent}%   「${
        fund.info.name
      }」\n--------------------------------------------\n`;
    }
    // tooltip 有限定高度，所以只展示最多14只基金
    const tips = this.fundService.fundList.length >= 14 ? '（只展示前14只）' : '';
    return `「基金详情」\n\n ${fundTemplate}${tips}`;
  }
}
