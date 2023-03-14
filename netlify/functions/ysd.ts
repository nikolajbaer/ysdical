import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import axios from 'axios'
import * as cheerio from 'cheerio';
import {DateTime} from 'luxon';

type ScheduleItem = {
  text: string;
  start:string;
  end:string;
  title:string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const response = await axios({
    method:'get',
    url: 'https://classembed.upacedev.com/schedule/88?gym=Mission+Valley+YMCA',
  })
  const $ = cheerio.load(response.data)

  // Extract Week

  // Build table
  const htmlTable = $('#schedule-table')
  const title = htmlTable.parent().siblings('div').text().trim()
  const rows = Array.from($('#schedule-table > tbody > tr'))
  const items:ScheduleItem[] = []

  // Extract start date
  const monday = new Date(Date.parse(title.replace("Schedule for week of ","")))
  const days = [...Array(7).keys()].map( i => {
    const day = DateTime.fromJSDate(monday).setZone('America/Los_Angeles').plus({days:i-1}); // week headline starts at monday
    return {day:day.day,month:day.month,year:day.year}
  })

  console.log(days)
  rows.forEach( (row,i) => {
    Array.from($('> td',row)).forEach((dayCell,j) => {
      const cells = Array.from($('table > tbody > tr > td',dayCell))
      cells.map( cell => {
        const lines = $(cell).text().trim().split('\n').map(line => line.trim()).filter(line => line !== '')
        if(lines.length === 0) return null
        const times = lines[0].split('-').map(t => {
          const hm = /(\d+):(\d+)(am|pm)/.exec(t.trim()) ?? [0,0,0,'am']
          const hour = Number(hm[1])
          return {...days[j],hour:hm[3]==='pm'?hour+12:hour,minute:Number(hm[2])}
        });
        return {
          dow: j,
          title: lines[1],
          text: lines.join('\n'),
          start: times[0],
          end: times[1],
        }
      }).forEach( item => {
        if(item !== null) items.push(item)
      });
    })
  })


  // TODO apply filter
  // TODO make iCal

  return {
    statusCode: 200,
    body: JSON.stringify({title:title,schedule:items}),
    headers: {
      "Content-Type":"text/json",
    }
  };
};
