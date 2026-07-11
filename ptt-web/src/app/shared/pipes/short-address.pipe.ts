import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appShortAddress',
  standalone: true
})
export class ShortAddressPipe implements PipeTransform {
  transform(value: any, startChars: number = 6, endChars: number = 4): string {
    if (!value) return '';
    const str = String(value).trim();
    if (str.length <= startChars + endChars + 3) {
      return str;
    }
    return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
  }
}
