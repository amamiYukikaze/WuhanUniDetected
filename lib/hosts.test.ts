import { describe, expect, it } from 'vitest';
import { HOST_ORG, isNewsHost, orgHintForHost } from './hosts';

describe('isNewsHost', () => {
  it('matches suffix hosts including www and subdomains', () => {
    expect(isNewsHost('www.thepaper.cn')).toBe(true);
    expect(isNewsHost('m.thepaper.cn')).toBe(true);
    expect(isNewsHost('www.people.com.cn')).toBe(true);
    expect(isNewsHost('finance.people.com.cn')).toBe(true);
    expect(isNewsHost('www.xinhuanet.com')).toBe(true);
    expect(isNewsHost('www.news.cn')).toBe(true);
    expect(isNewsHost('tv.cctv.com')).toBe(true);
    expect(isNewsHost('www.chinanews.com.cn')).toBe(true);
    expect(isNewsHost('www.gmw.cn')).toBe(true);
    expect(isNewsHost('paper.ce.cn')).toBe(true);
    expect(isNewsHost('world.huanqiu.com')).toBe(true);
    expect(isNewsHost('www.qstheory.cn')).toBe(true);
    expect(isNewsHost('www.caixin.com')).toBe(true);
    expect(isNewsHost('www.bjnews.com.cn')).toBe(true);
    expect(isNewsHost('www.infzm.com')).toBe(true);
    expect(isNewsHost('www.oeeee.com')).toBe(true);
    expect(isNewsHost('www.bjd.com.cn')).toBe(true);
    expect(isNewsHost('www.jfdaily.com')).toBe(true);
    expect(isNewsHost('www.whb.cn')).toBe(true);
    expect(isNewsHost('zqb.cyol.com')).toBe(true);
    expect(isNewsHost('www.chinadaily.com.cn')).toBe(true);
    expect(isNewsHost('www.cankaoxiaoxi.com')).toBe(true);
    expect(isNewsHost('www.legaldaily.com.cn')).toBe(true);
    expect(isNewsHost('www.stdaily.com')).toBe(true);
    expect(isNewsHost('www.workercn.cn')).toBe(true);
    expect(isNewsHost('www.farmer.com.cn')).toBe(true);
    expect(isNewsHost('news.163.com')).toBe(true);
    expect(isNewsHost('www.news.163.com')).toBe(true);
    expect(isNewsHost('c.m.163.com')).toBe(true);
    expect(isNewsHost('news.sina.com.cn')).toBe(true);
    expect(isNewsHost('news.qq.com')).toBe(true);
    expect(isNewsHost('www.new.qq.com')).toBe(true);
    expect(isNewsHost('view.inews.qq.com')).toBe(true);
    expect(isNewsHost('news.sohu.com')).toBe(true);
    expect(isNewsHost('www.sohu.com')).toBe(true);
    expect(isNewsHost('news.ifeng.com')).toBe(true);
    expect(isNewsHost('www.yidianzixun.com')).toBe(true);
    expect(isNewsHost('www.toutiao.com')).toBe(true);
    expect(isNewsHost('36kr.com')).toBe(true);
    expect(isNewsHost('www.huxiu.com')).toBe(true);
    expect(isNewsHost('www.tmtpost.com')).toBe(true);
    expect(isNewsHost('www.yicai.com')).toBe(true);
    expect(isNewsHost('www.21jingji.com')).toBe(true);
    expect(isNewsHost('www.stcn.com')).toBe(true);
    expect(isNewsHost('www.cs.com.cn')).toBe(true);
    expect(isNewsHost('www.cnstock.com')).toBe(true);
  });

  it('does not match non-news or oversized portals', () => {
    expect(isNewsHost('example.com')).toBe(false);
    expect(isNewsHost('github.com')).toBe(false);
    expect(isNewsHost('mail.163.com')).toBe(false);
    expect(isNewsHost('music.163.com')).toBe(false);
    expect(isNewsHost('mail.qq.com')).toBe(false);
    expect(isNewsHost('weixin.qq.com')).toBe(false);
    expect(isNewsHost('www.baidu.com')).toBe(false);
  });

  it('maps org hints for known hosts', () => {
    expect(orgHintForHost('www.thepaper.cn')).toBe('澎湃新闻');
    expect(orgHintForHost('news.qq.com')).toBe('腾讯新闻');
    expect(orgHintForHost('www.toutiao.com')).toBe('今日头条');
    expect(orgHintForHost('example.com')).toBeUndefined();
    expect(HOST_ORG['qstheory.cn']).toBe('求是');
  });
});
