import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import axios from 'axios'
import * as cheerio from 'cheerio';
import {DateTime} from 'luxon';
import {ICalCalendar} from 'ical-generator';

type ScheduleItem = {
  text: string;
  start: Date;
  end: Date;
  title:string;
  location: string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const classes = event.queryStringParameters?.classes?.split(',').map(c=>c.toLowerCase()) ?? null
  const locations = event.queryStringParameters?.locations?.split(',') ?? ['Mission Valley YMCA','Toby Wells YMCA']
  const tz = 'America/Los_Angeles'

  const response = await axios({
    method:'get',
    url: `https://classembed.upacedev.com/schedule/88`,
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
    const day = DateTime.fromJSDate(monday,{zone:tz}).plus({days:i-1}); // week headline starts at monday
    return {day:day.day,month:day.month,year:day.year}
  })

  rows.forEach( (row,i) => {
    Array.from($('> td',row)).forEach((dayCell,j) => {
      const cells = Array.from($('table > tbody > tr > td',dayCell))
      cells.map( cell => {
        const lines = $(cell).text().trim().split('\n').map(line => line.trim()).filter(line => line !== '')
        if(lines.length === 0) return null
        const times = lines[0].split('-').map(t => {
          const hm = /(\d+):(\d+)(am|pm)/.exec(t.trim()) ?? [0,0,0,'am']
          const hour = Number(hm[1])
          return {...days[j],hour:(hm[3]==='pm' && hour <12)?hour+12:hour,minute:Number(hm[2])}
        });
        return {
          title: lines[1],
          location: lines[4],
          text: lines.join('\n'),
          start: DateTime.fromObject(times[0],{zone:tz}).toJSDate(),
          end: DateTime.fromObject(times[1],{zone:tz}).toJSDate(),
        }
      }).forEach( item => {
        if(item !== null) items.push(item)
      });
    })
  })

  // Generate iCalendar
  const calendar = new ICalCalendar({name:'SD Y Group Fitness Classes'})
  // Apply filter
  items.filter( item => {
    if(!locations.includes(item.location)) return false
    const t = item.title.trim().toLowerCase()
    if(classes && classes.filter(s=>t === s).length <= 0){
      return false 
    }
    return true
  }).forEach( item => {
    calendar.createEvent({
      start: item.start,
      end: item.end,
      location: item.location,
      summary: item.title,
      description: item.text,
    })
  })    

  // TODO good expires header
  return {
    statusCode: 200,
    body: calendar.toString(),
    headers: {
      "Content-Type":"text/calendar",
    }
  };
};
