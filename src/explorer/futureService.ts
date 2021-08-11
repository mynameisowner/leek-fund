import Axios from 'axios';
import { decode } from 'iconv-lite';
import { ExtensionContext, QuickPickItem, window } from 'vscode';
import globalState from '../globalState';
import { LeekFundConfig } from '../shared/leekConfig';
import { LeekTreeItem } from '../shared/leekTreeItem';
import { executeStocksRemind } from '../shared/remindNotification';
import { FUTURE_TYPE, TreeItemType } from '../shared/typed';
import { calcFixedPriceNumber, formatNumber, randHeader, sortData, events } from '../shared/utils';
import { LeekService } from './leekService';

export default class futureService extends LeekService {
  public futureList: Array<LeekTreeItem> = [];
  // public statusBarFutureList: Array<LeekTreeItem> = [];

  private context: ExtensionContext;
  private defaultBarFuture: LeekTreeItem | null = null;
  private searchFutureKeyMap: any = {}; // 标记搜索不到记录，避免死循环

  constructor(context: ExtensionContext) {
    super();
    this.context = context;
  }

  async getData(codes: Array<string>, order: number): Promise<Array<LeekTreeItem>> {
    console.log('fetching future data…');
    if ((codes && codes.length === 0) || !codes) {
      return [];
    }
    // const statusBarFuture = LeekFundConfig.getConfig('leek-fund.statusBarFuture');

    const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
    try {
      const resp = await Axios.get(url, {
        // axios 乱码解决
        responseType: 'arraybuffer',
        transformResponse: [
          (data) => {
            const body = decode(data, 'GB18030');
            return body;
          },
        ],
        headers: randHeader(),
      });
      let futureList: Array<LeekTreeItem> = [];
      // const barFutureList: Array<LeekTreeItem> = [];
      if (/FAILED/.test(resp.data)) {
        if (codes.length === 1) {
          window.showErrorMessage(
            `fail: error Future code in ${codes}, please delete error Future code`
          );
          return [
            {
              id: codes[0],
              type: '',
              contextValue: 'failed',
              isCategory: false,
              info: { code: codes[0], percent: '0', name: '错误代码' },
              label: codes[0] + ' 错误代码，请查看是否缺少交易所信息',
            },
          ];
        }
        for (const code of codes) {
          futureList = futureList.concat(await this.getData(new Array(code), order));
        }
        return futureList;
      }

      const splitData = resp.data.split(';\n');
      // let sz: LeekTreeItem | null = null;
      let noDataFutureCount = 0;
      let futureCount = 0;
      for (let i = 0; i < splitData.length - 1; i++) {
        const code = splitData[i].split('="')[0].split('var hq_str_')[1];
        const params = splitData[i].split('="')[1].split(',');
        let type = code.substr(0, 2) || 'sh';
        let symbol = code.substr(2);
        let futureItem: any;
        let fixedNumber = 2;
        if (params.length > 1) {
          if (/^[a-zA-Z]+\d{4}$/.test(code)) {
            let open = params[2];
            let yestclose = params[5];
            let price = params[8];
            let high = params[3];
            let low = params[4];
            fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
            futureItem = {
              code,
              name: params[0],
              open: formatNumber(open, fixedNumber, false),
              yestclose: formatNumber(yestclose, fixedNumber, false),
              price: formatNumber(price, fixedNumber, false),
              low: formatNumber(low, fixedNumber, false),
              high: formatNumber(high, fixedNumber, false),
              volume: formatNumber(params[14], 2),
              time:`${params[30]} ${params[17]}`,
              percent: '',
              _itemType: TreeItemType.FUTURE,
            };
            futureCount += 1;
          }
          if (futureItem) {
            const { yestclose, open } = futureItem;
            let { price } = futureItem;
            /*  if (open === price && price === '0.00') {
            futureItem.isStop = true;
          } */

            // 竞价阶段部分开盘和价格为0.00导致显示 -100%
            try {
              if (Number(open) <= 0) {
                price = yestclose;
              }
            } catch (err) {
              console.error(err);
            }
            futureItem.showLabel = this.showLabel;
            futureItem.isFuture = true;
            futureItem.type = type;
            futureItem.symbol = symbol;
            futureItem.updown = formatNumber(+price - +yestclose, fixedNumber, false);
            futureItem.percent =
              (futureItem.updown >= 0 ? '+' : '-') +
              formatNumber((Math.abs(futureItem.updown) / +yestclose) * 100, 2, false);

            const treeItem = new LeekTreeItem(futureItem, this.context);
            // if (code === 'sh000001') {
            //   sz = treeItem;
            // }
            // if (statusBarFuture.includes(code)) {
            //   barFutureList.push(treeItem);
            // }
            futureList.push(treeItem);
          }
        } else {
          // 接口不支持的
          noDataFutureCount += 1;
          futureItem = {
            id: code,
            name: `接口不支持该股票 ${code}`,
            showLabel: this.showLabel,
            isFuture: true,
            percent: '',
            type: 'nodata',
            contextValue: 'nodata',
          };
          const treeItem = new LeekTreeItem(futureItem, this.context);
          futureList.push(treeItem);
        }
      }
      // this.defaultBarFuture = sz || futureList[0];
      const res = sortData(futureList, order);
      executeStocksRemind(res, this.futureList);
      const oldFutureList = this.futureList;
      this.futureList = res;
      events.emit('futureListUpdate', this.futureList, oldFutureList);
      /* if (barFutureList.length === 0) {
        // 用户没有设置股票时，默认展示上证或第一个
        barFutureList.push(this.defaultBarFuture);
      }
      this.statusBarFutureList = sortData(barFutureList, order); */
      globalState.noDataFutureCount = noDataFutureCount;
      globalState.futureCount = futureCount;
      return res;
    } catch (err) {
      console.info(url);
      console.error(err);
      if (globalState.showFutureErrorInfo) {
        window.showErrorMessage(`fail: Future error ` + url);
        globalState.showFutureErrorInfo = false;
        globalState.telemetry.sendEvent('error: futureService', {
          url,
          error: err,
        });
      }

      return [];
    }
  }

  async getFutureSuggestList(searchText = '', type = '2'): Promise<QuickPickItem[]> {
    if (!searchText) {
      return [{ label: '请输入关键词查询，如：0000001 或 上证指数' }];
    }
    const url = `http://suggest3.sinajs.cn/suggest/type=${type}&key=${encodeURIComponent(
      searchText
    )}`;
    try {
      console.log('getFutureSuggestList: getting...');
      const result: QuickPickItem[] = [];
      return result;
    } catch (err) {
      console.log(url);
      console.error(err);
      return [{ label: '查询失败，请重试' }];
    }
  }
}
