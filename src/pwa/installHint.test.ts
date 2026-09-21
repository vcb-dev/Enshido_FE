import { describe, expect, it } from 'vitest'
import { installHint } from './installHint'

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipadOs:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  zaloAndroid:
    'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36 Zalo android/12110635 ZaloTheme/light ZaloLanguage/vi',
  zaloIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/25.07.01 ZaloTheme/light ZaloLanguage/vi',
  messenger:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/520.0.0.30.109]',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
}

const base = { maxTouchPoints: 5, standalone: false, canPrompt: false }

describe('installHint — nhắc cài app theo từng máy', () => {
  it('Android Chrome đã báo cài được thì hiện nút Cài đặt', () => {
    expect(installHint({ ...base, userAgent: UA.androidChrome, canPrompt: true })).toBe('prompt')
  })

  it('Android Chrome chưa báo thì im — không hứa cái nút bấm không được', () => {
    expect(installHint({ ...base, userAgent: UA.androidChrome })).toBe('none')
  })

  it('iPhone và iPad (tự nhận là Mac) chỉ đường qua nút Chia sẻ', () => {
    expect(installHint({ ...base, userAgent: UA.iphoneSafari })).toBe('ios')
    expect(installHint({ ...base, userAgent: UA.ipadOs })).toBe('ios')
  })

  it('mở trong Zalo/Messenger thì nhắc ra trình duyệt thật, kể cả trên iPhone', () => {
    expect(installHint({ ...base, userAgent: UA.zaloAndroid, canPrompt: true })).toBe('in-app')
    expect(installHint({ ...base, userAgent: UA.zaloIos })).toBe('in-app')
    expect(installHint({ ...base, userAgent: UA.messenger })).toBe('in-app')
  })

  it('đã mở từ màn hình chính thì không nhắc gì', () => {
    expect(installHint({ ...base, userAgent: UA.iphoneSafari, standalone: true })).toBe('none')
    expect(
      installHint({ ...base, userAgent: UA.androidChrome, standalone: true, canPrompt: true }),
    ).toBe('none')
  })

  it('máy tính không cảm ứng của quản lý không bị mời cài', () => {
    expect(
      installHint({ ...base, userAgent: UA.desktopChrome, maxTouchPoints: 0, canPrompt: true }),
    ).toBe('none')
    // Mac thật (không cảm ứng) không bị nhầm là iPad.
    expect(installHint({ ...base, userAgent: UA.ipadOs, maxTouchPoints: 0 })).toBe('none')
  })
})
