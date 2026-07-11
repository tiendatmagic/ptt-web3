import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vnd',
  standalone: true
})
export class VNDCurrencyPipe implements PipeTransform {
  transform(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '0đ';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return '0đ';
    }
    return new Intl.NumberFormat('en-US').format(num) + 'đ';
  }
}
